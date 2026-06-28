import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p58220589_site_structure_repli')


def handler(event: dict, context) -> dict:
    """Возвращает публичный каталог комплектов наград из базы данных."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, title, description, composition, price, icon, photo_url, sort_order FROM {SCHEMA}.award_catalog WHERE is_active=TRUE ORDER BY sort_order, id"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    catalog = []
    for r in rows:
        catalog.append({
            'id': str(r[0]),
            'title': r[1],
            'description': r[2] or '',
            'composition': list(r[3]) if r[3] else [],
            'price': float(r[4]) if r[4] is not None else None,
            'icon': r[5] or 'award',
            'photo_url': r[6],
            'sort_order': r[7],
        })

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps({'catalog': catalog})
    }
