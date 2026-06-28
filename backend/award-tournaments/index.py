import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p58220589_site_structure_repli')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
}


def handler(event: dict, context) -> dict:
    """Турниры для каталога наград. GET — публичный, POST — только с паролем."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if method == 'GET':
        cur.execute(f"SELECT id, title, date FROM {SCHEMA}.award_tournaments ORDER BY date DESC NULLS LAST, id DESC")
        rows = cur.fetchall()
        tournaments = [{'id': r[0], 'title': r[1], 'date': r[2].isoformat() if r[2] else None} for r in rows]
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'tournaments': tournaments})}

    if method == 'POST':
        pwd = event.get('headers', {}).get('X-Admin-Password', '')
        if pwd != ADMIN_PASSWORD:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}

        body = json.loads(event.get('body') or '{}')
        action = body.get('_action')

        if action == 'delete':
            cur.execute(f"DELETE FROM {SCHEMA}.award_tournaments WHERE id = %s", (body['id'],))
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

        title = body.get('title', '').strip()
        date = body.get('date') or None
        if not title:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'title required'})}

        cur.execute(
            f"INSERT INTO {SCHEMA}.award_tournaments (title, date) VALUES (%s, %s) RETURNING id",
            (title, date)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True, 'id': new_id})}

    conn.close()
    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}
