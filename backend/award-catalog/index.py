import json


def handler(event: dict, context) -> dict:
    """Возвращает каталог комплектов наград."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    catalog = [
        {
            "id": "standard",
            "title": "Стандарт",
            "description": "Медали для призёров: 1, 2 и 3 место",
            "composition": ["Медаль 1 место — 1 шт.", "Медаль 2 место — 1 шт.", "Медаль 3 место — 1 шт."],
            "price": 1500,
            "icon": "medal"
        },
        {
            "id": "premium",
            "title": "Премиум",
            "description": "Кубок победителю и медали для призёров",
            "composition": ["Кубок 1 место — 1 шт.", "Медаль 2 место — 1 шт.", "Медаль 3 место — 1 шт."],
            "price": 3500,
            "icon": "trophy"
        },
        {
            "id": "full",
            "title": "Полный",
            "description": "Кубки и медали для топ-3, грамоты для всех участников",
            "composition": ["Кубок 1 место — 1 шт.", "Кубок 2 место — 1 шт.", "Кубок 3 место — 1 шт.", "Грамоты участника — до 30 шт."],
            "price": 7500,
            "icon": "award"
        },
        {
            "id": "custom",
            "title": "Индивидуальный",
            "description": "Состав обсуждается отдельно под ваш турнир",
            "composition": ["Состав по договорённости"],
            "price": None,
            "icon": "star"
        }
    ]

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps({'catalog': catalog})
    }