import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def handler(event: dict, context) -> dict:
    """Управление турнирами: создание, получение списка, удаление"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = event.get('headers', {}) or {}
    admin_password = headers.get('X-Admin-Password', '')
    if admin_password != os.environ.get('ADMIN_PASSWORD', ''):
        return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Неверный пароль'})}

    method = event.get('httpMethod')
    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        cur.execute("SELECT id, title, description, date, location, age_category, price, fsr_id, created_at, status FROM tournaments ORDER BY created_at DESC")
        rows = cur.fetchall()
        tournaments = []
        for r in rows:
            tournaments.append({
                'id': r[0], 'title': r[1], 'description': r[2],
                'date': str(r[3]) if r[3] else None, 'location': r[4],
                'age_category': r[5], 'price': float(r[6]) if r[6] else None,
                'fsr_id': r[7], 'created_at': str(r[8]), 'status': r[9]
            })
        conn.close()
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'tournaments': tournaments})}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        action = body.get('_action', '')

        if action == 'delete':
            tournament_id = body.get('id')
            # Сначала удаляем заказы, связанные с заявками этого турнира,
            # затем сами заявки — иначе внешние ключи не дадут удалить турнир
            cur.execute(
                "DELETE FROM orders WHERE application_id IN (SELECT id FROM applications WHERE tournament_id = %s)",
                (tournament_id,)
            )
            cur.execute("DELETE FROM applications WHERE tournament_id = %s", (tournament_id,))
            cur.execute("DELETE FROM tournaments WHERE id = %s", (tournament_id,))
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True})}

        if action == 'set_status':
            cur.execute("UPDATE tournaments SET status = %s WHERE id = %s", (body.get('status'), body.get('id')))
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True})}

        if action == 'update':
            cur.execute(
                "UPDATE tournaments SET title = %s, description = %s, date = %s, location = %s, age_category = %s, price = %s, fsr_id = %s WHERE id = %s",
                (body.get('title'), body.get('description'), body.get('date') or None,
                 body.get('location'), body.get('age_category'), body.get('price') or None, body.get('fsr_id'),
                 body.get('id'))
            )
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True})}

        cur.execute(
            "INSERT INTO tournaments (title, description, date, location, age_category, price, fsr_id) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body.get('title'), body.get('description'), body.get('date') or None,
             body.get('location'), body.get('age_category'), body.get('price') or None, body.get('fsr_id'))
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True, 'id': new_id})}

    conn.close()
    return {'statusCode': 405, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Method not allowed'})}