"""YooKassa webhook handler for payment notifications."""
import json
import os
import base64
import urllib.parse
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import psycopg2

SENDER_EMAIL = 'mir.shahmat@inbox.ru'
SENDER_NAME = 'ЦПДШС "Мир шахмат"'
LOGO_URL = 'https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/5cb279c6-66b4-4693-bc8b-8649fcf4b0a8.png'


def unisender_call(method: str, params: dict) -> dict:
    api_key = os.environ.get('UNISENDER_API_KEY', '')
    if not api_key:
        return {}
    all_params = {'format': 'json', 'api_key': api_key, **params}
    data = urllib.parse.urlencode(all_params).encode('utf-8')
    req = Request(f'https://api.unisender.com/ru/api/{method}', data=data, method='POST')
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))


def get_or_create_list_id() -> str:
    list_title = 'Тренеры и руководители'
    result = unisender_call('getLists', {})
    lists = result.get('result', []) or []
    for lst in lists:
        if lst.get('title') == list_title:
            return str(lst.get('id'))
    created = unisender_call('createList', {'title': list_title})
    return str(created.get('result', {}).get('id'))


def build_subscription_email_html(customer_name: str, code: str, plan_title: str, participations: int) -> str:
    greeting = f'Здравствуйте, {customer_name}!' if customer_name else 'Здравствуйте!'
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ваш абонемент оплачен</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; max-width:600px; width:100%;">
        <tr>
          <td style="background-color:#141414; padding:28px 32px; text-align:center;">
            <img src="{LOGO_URL}" alt="Мир шахмат" width="160" height="63" style="display:block; margin:0 auto 12px;">
            <div style="color:#E8B600; font-size:13px; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">Абонемент оплачен</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0; color:#141414; font-size:24px; line-height:1.3;">🎟️ Спасибо за покупку!</h1>
            <p style="margin:14px 0 0; color:#444444; font-size:15px; line-height:1.6;">{greeting} Ваш абонемент «{plan_title}» успешно оплачен. Используйте код ниже при подаче заявки на любой платный турнир — вместо оплаты.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed #E8B600; border-radius:14px;">
              <tr>
                <td style="padding:22px; text-align:center;">
                  <div style="color:#999999; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Код абонемента</div>
                  <div style="color:#141414; font-size:28px; font-weight:bold; letter-spacing:2px; font-family:monospace;">{code}</div>
                  <div style="color:#8a6d00; font-size:13px; margin-top:10px;">Доступно участий: {participations}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <h2 style="margin:0 0 10px; color:#141414; font-size:16px;">Как использовать</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0; color:#444444; font-size:14px; line-height:1.6;">✅ Откройте страницу турнира и нажмите «Подать заявку»</td></tr>
              <tr><td style="padding:4px 0; color:#444444; font-size:14px; line-height:1.6;">✅ Выберите способ участия «Абонемент» и введите код</td></tr>
              <tr><td style="padding:4px 0; color:#444444; font-size:14px; line-height:1.6;">✅ Код спишет одно участие и его можно использовать снова на других турнирах</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 32px;" align="center">
            <a href="https://мир-шахмат.рф/turnir" target="_blank" style="display:inline-block; background-color:#E8B600; color:#141414; text-decoration:none; font-weight:bold; font-size:15px; padding:14px 36px; border-radius:10px;">Перейти к турнирам</a>
          </td>
        </tr>
        <tr>
          <td style="background-color:#141414; padding:24px 32px; text-align:center;">
            <p style="margin:0 0 6px; color:#ffffff; font-size:14px; font-weight:bold;">Мир шахмат</p>
            <p style="margin:0 0 4px; color:#aaaaaa; font-size:12px;">Центр поддержки детского шахматного спорта</p>
            <p style="margin:0 0 4px; color:#aaaaaa; font-size:12px;">
              <a href="mailto:mir.shahmat@inbox.ru" style="color:#E8B600; text-decoration:none;">mir.shahmat@inbox.ru</a>
              &nbsp;·&nbsp;
              <a href="tel:+79922281068" style="color:#E8B600; text-decoration:none;">+7 99 222-810-68</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def send_subscription_email(to_email: str, to_name: str, code: str, plan_title: str, participations: int):
    if not to_email:
        return
    try:
        list_id = get_or_create_list_id()
        html = build_subscription_email_html(to_name, code, plan_title, participations)
        unisender_call('sendEmail', {
            'email': to_email,
            'sender_name': SENDER_NAME,
            'sender_email': SENDER_EMAIL,
            'subject': f'Ваш абонемент «{plan_title}» оплачен — код внутри',
            'body': html,
            'list_id': list_id,
        })
    except Exception:
        pass

# =============================================================================
# CONSTANTS
# =============================================================================

HEADERS = {
    'Content-Type': 'application/json'
}

YOOKASSA_API_URL = "https://api.yookassa.ru/v3/payments"


# =============================================================================
# SECURITY
# =============================================================================

def verify_payment_via_api(payment_id: str, shop_id: str, secret_key: str) -> dict | None:
    """Verify payment status via YooKassa API.

    YooKassa doesn't use webhook signatures. The recommended approach is to
    verify payment status by making a GET request to the API.
    """
    auth_string = f"{shop_id}:{secret_key}"
    auth_bytes = base64.b64encode(auth_string.encode()).decode()

    request = Request(
        f"{YOOKASSA_API_URL}/{payment_id}",
        headers={
            'Authorization': f'Basic {auth_bytes}',
            'Content-Type': 'application/json'
        },
        method='GET'
    )

    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode())
    except (HTTPError, Exception):
        return None


# =============================================================================
# DATABASE
# =============================================================================

def get_connection():
    """Get database connection."""
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_schema() -> str:
    """Get database schema prefix."""
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return f"{schema}." if schema else ""


# =============================================================================
# HANDLER
# =============================================================================

def handler(event, context):
    """Handle YooKassa webhook notification."""
    if event.get('httpMethod') != 'POST':
        return {
            'statusCode': 405,
            'headers': HEADERS,
            'body': json.dumps({'error': 'Method not allowed'})
        }

    # Parse body
    body = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body = base64.b64decode(body).decode('utf-8')

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': HEADERS,
            'body': json.dumps({'error': 'Invalid JSON'})
        }

    # Extract payment info
    event_type = data.get('event', '')
    payment_object = data.get('object', {})
    payment_id = payment_object.get('id', '')
    metadata = payment_object.get('metadata', {})

    if not payment_id:
        return {
            'statusCode': 400,
            'headers': HEADERS,
            'body': json.dumps({'error': 'Missing payment id'})
        }

    # Security: Verify payment via API (most reliable)
    shop_id = os.environ.get('YOOKASSA_SHOP_ID', '')
    secret_key = os.environ.get('YOOKASSA_SECRET_KEY', '')

    if shop_id and secret_key:
        verified_payment = verify_payment_via_api(payment_id, shop_id, secret_key)
        if not verified_payment:
            return {
                'statusCode': 400,
                'headers': HEADERS,
                'body': json.dumps({'error': 'Payment verification failed'})
            }
        # Use verified status instead of webhook data
        payment_status = verified_payment.get('status', '')
    else:
        # Fallback to webhook data (less secure, only if credentials missing)
        payment_status = payment_object.get('status', '')

    S = get_schema()
    conn = get_connection()

    try:
        cur = conn.cursor()
        now = datetime.utcnow().isoformat()

        # Find order by payment_id
        cur.execute(f"""
            SELECT id, status, application_id, order_type, items_data, user_name, user_phone, user_email, delivery_address, order_comment, amount, subscription_id
            FROM {S}orders
            WHERE yookassa_payment_id = %s
        """, (payment_id,))

        row = cur.fetchone()

        if not row:
            # Try to find by order_id from metadata
            order_id_meta = metadata.get('order_id')
            if order_id_meta:
                cur.execute(f"""
                    SELECT id, status, application_id, order_type, items_data, user_name, user_phone, user_email, delivery_address, order_comment, amount, subscription_id
                    FROM {S}orders WHERE id = %s
                """, (int(order_id_meta),))
                row = cur.fetchone()

        if not row:
            return {
                'statusCode': 404,
                'headers': HEADERS,
                'body': json.dumps({'error': 'Order not found'})
            }

        (order_id, current_status, application_id, order_type, items_data,
         user_name, user_phone, user_email, delivery_address, order_comment, amount, subscription_id) = row

        # Update based on verified payment status
        if payment_status == 'succeeded':
            if current_status != 'paid':
                cur.execute(f"""
                    UPDATE {S}orders
                    SET status = 'paid', paid_at = %s, updated_at = %s
                    WHERE id = %s
                """, (now, now, order_id))
                # Заявка на турнир подтверждается только после успешной оплаты
                if application_id:
                    cur.execute(f"""
                        UPDATE {S}applications
                        SET status = 'paid'
                        WHERE id = %s AND status = 'pending_payment'
                    """, (application_id,))
                # Заказ наград создаётся в базе только после успешной оплаты
                if order_type == 'award' and items_data is not None:
                    parsed_items = json.loads(items_data) if isinstance(items_data, str) else items_data
                    order_items = parsed_items.get('items', [])
                    order_notes = parsed_items.get('notes') or order_comment
                    cur.execute(f"""
                        INSERT INTO {S}award_orders
                        (customer_name, customer_phone, customer_email, items, total_price, notes, status)
                        VALUES (%s, %s, %s, %s, %s, %s, 'new')
                        RETURNING id
                    """, (
                        parsed_items.get('customer_name') or user_name,
                        parsed_items.get('customer_phone') or user_phone,
                        parsed_items.get('customer_email') or user_email or None,
                        json.dumps(order_items, ensure_ascii=False),
                        amount, order_notes or None
                    ))
                    award_order_id = cur.fetchone()[0]
                    cur.execute(f"""
                        UPDATE {S}orders SET award_order_id = %s WHERE id = %s
                    """, (award_order_id, order_id))
                # Абонемент активируется (переводится в paid) только после успешной оплаты
                if order_type == 'subscription' and subscription_id:
                    cur.execute(f"""
                        UPDATE {S}subscriptions SET status = 'paid', paid_at = %s WHERE id = %s
                    """, (now, subscription_id))
                    cur.execute(f"""
                        SELECT code, plan_title, total_participations, customer_email, customer_name
                        FROM {S}subscriptions WHERE id = %s
                    """, (subscription_id,))
                    sub_row = cur.fetchone()
                conn.commit()
                if order_type == 'subscription' and subscription_id and sub_row:
                    sub_code, sub_plan_title, sub_total, sub_email, sub_name = sub_row
                    send_subscription_email(sub_email, sub_name or '', sub_code, sub_plan_title, sub_total)

        elif payment_status == 'canceled':
            if current_status not in ('paid', 'canceled'):
                cur.execute(f"""
                    UPDATE {S}orders
                    SET status = 'canceled', updated_at = %s
                    WHERE id = %s
                """, (now, order_id))
                # Отменённая оплата — отменяем и заявку, чтобы она не висела вечно в ожидании
                if application_id:
                    cur.execute(f"""
                        UPDATE {S}applications
                        SET status = 'cancelled'
                        WHERE id = %s AND status = 'pending_payment'
                    """, (application_id,))
                # Неоплаченный абонемент удаляем, чтобы не висел мёртвой записью
                if order_type == 'subscription' and subscription_id:
                    cur.execute(f"""
                        DELETE FROM {S}subscriptions WHERE id = %s AND status = 'pending_payment'
                    """, (subscription_id,))
                conn.commit()

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps({'status': 'ok'})
        }

    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({'error': 'Internal error'})
        }
    finally:
        conn.close()