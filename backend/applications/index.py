import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }

def handler(event: dict, context) -> dict:
    """Управление заявками на турниры: публичное создание и админское CRUD"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')  # 'update' для редактирования

    conn = get_conn()
    cur = conn.cursor()

    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')

    # GET — публичный (только участники) или админский (полные заявки)
    if method == 'GET':
        tournament_id = (event.get('queryStringParameters') or {}).get('tournament_id')
        if not is_admin:
            # Публичный: только ФИО и возраст, tournament_id обязателен
            # Заявки, ожидающие оплаты, в список участников не попадают
            if not tournament_id:
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'tournament_id required'})}
            cur.execute(
                "SELECT fio, age FROM applications WHERE tournament_id = %s AND status NOT IN ('cancelled', 'pending_payment') ORDER BY created_at ASC",
                (tournament_id,)
            )
            rows = cur.fetchall()
            conn.close()
            participants = [{'fio': r[0], 'age': r[1]} for r in rows]
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'participants': participants, 'count': len(participants)})}

    # Публичное создание заявки (POST без _action и без пароля)
    # Если турнир платный (передан флаг requires_payment) — заявка создаётся со статусом pending_payment
    # и попадёт в список участников только после подтверждения оплаты через webhook
    if method == 'POST' and action != 'update' and not is_admin:
        initial_status = 'pending_payment' if body.get('requires_payment') else 'new'
        cur.execute(
            """INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (body.get('tournament_id'), body.get('tournament_title'), body.get('fio'),
             body.get('age'), body.get('fsr_id'), body.get('coach'),
             body.get('country_city'), body.get('school'), body.get('email'), body.get('phone'),
             initial_status)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'id': new_id})}

    # Все остальные — только для админа
    if not is_admin:
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}

    # GET — полный список заявок для админа
    if method == 'GET':
        tournament_id = (event.get('queryStringParameters') or {}).get('tournament_id')
        if tournament_id:
            cur.execute(
                "SELECT id, tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, notes, created_at FROM applications WHERE tournament_id = %s ORDER BY created_at DESC",
                (tournament_id,)
            )
        else:
            cur.execute(
                "SELECT id, tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, notes, created_at FROM applications ORDER BY created_at DESC"
            )
        rows = cur.fetchall()
        conn.close()
        cols = ['id', 'tournament_id', 'tournament_title', 'fio', 'age', 'fsr_id', 'coach', 'country_city', 'school', 'email', 'phone', 'status', 'notes', 'created_at']
        apps = [dict(zip(cols, r)) for r in rows]
        for a in apps:
            a['created_at'] = str(a['created_at'])
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'applications': apps})}

    # Редактирование заявки (_action: update)
    if method == 'POST' and action == 'update':
        cur.execute(
            "UPDATE applications SET fio=%s, age=%s, fsr_id=%s, coach=%s, country_city=%s, school=%s, email=%s, phone=%s, status=%s, notes=%s WHERE id=%s",
            (body.get('fio'), body.get('age'), body.get('fsr_id'), body.get('coach'),
             body.get('country_city'), body.get('school'), body.get('email'), body.get('phone'),
             body.get('status', 'new'), body.get('notes', ''), body.get('id'))
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}