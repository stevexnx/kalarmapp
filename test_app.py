"""
Suite de pruebas automatizadas completas para SubTracker Pro.
Verifica cálculos, autenticación, amigos, saldos, pagos, calendario y endpoints REST.
"""
import unittest
import os
import tempfile
import json
import threading
import urllib.request
import socket
from datetime import date, timedelta

from backend import db, server

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

class TestSubscriptionCalculations(unittest.TestCase):
    def test_monthly_calculation(self):
        m, a = db.calculate_costs(10.0, 'monthly')
        self.assertEqual(m, 10.0)
        self.assertEqual(a, 120.0)

    def test_annual_calculation(self):
        m, a = db.calculate_costs(120.0, 'annual')
        self.assertEqual(m, 10.0)
        self.assertEqual(a, 120.0)

    def test_weekly_calculation(self):
        m, a = db.calculate_costs(5.0, 'weekly')
        self.assertEqual(a, 260.0)
        self.assertEqual(m, 21.67)

    def test_quarterly_calculation(self):
        m, a = db.calculate_costs(30.0, 'quarterly')
        self.assertEqual(a, 120.0)
        self.assertEqual(m, 10.0)

    def test_biannual_calculation(self):
        m, a = db.calculate_costs(50.0, 'biannual')
        self.assertEqual(a, 100.0)
        self.assertEqual(m, 8.33)

    def test_currency_conversion(self):
        rates = {'USD': 1.0, 'EUR': 0.90, 'MXN': 20.0, 'DOP': 60.0}
        c = db.convert_currency(100.0, 'USD', 'EUR', rates)
        self.assertEqual(c, 90.0)
        c2 = db.convert_currency(200.0, 'MXN', 'USD', rates)
        self.assertEqual(c2, 10.0)
        c3 = db.convert_currency(10.0, 'USD', 'DOP', rates)
        self.assertEqual(c3, 600.0)
        c4 = db.convert_currency(600.0, 'DOP', 'USD', rates)
        self.assertEqual(c4, 10.0)

class TestAuthAndFriends(unittest.TestCase):
    def setUp(self):
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix='.db')
        db.init_db(self.temp_db_path)

    def tearDown(self):
        os.close(self.temp_db_fd)
        if os.path.exists(self.temp_db_path):
            os.remove(self.temp_db_path)

    def test_register_and_authenticate(self):
        user = db.register_user('juanito', 'claveSegura123', email='juan@correo.com', display_name='Juan P', db_path=self.temp_db_path)
        self.assertEqual(user['username'], 'juanito')
        self.assertEqual(user['display_name'], 'Juan P')

        # Autenticación exitosa
        auth = db.authenticate_user('juanito', 'claveSegura123', db_path=self.temp_db_path)
        self.assertIsNotNone(auth)
        self.assertEqual(auth['id'], user['id'])

        # Autenticación fallida
        auth_bad = db.authenticate_user('juanito', 'claveErronea', db_path=self.temp_db_path)
        self.assertIsNone(auth_bad)

        # Crear y validar sesión
        token = db.create_session(user['id'], db_path=self.temp_db_path)
        session_user = db.get_user_by_session(token, db_path=self.temp_db_path)
        self.assertIsNotNone(session_user)
        self.assertEqual(session_user['username'], 'juanito')

        # Eliminar sesión
        db.delete_session(token, db_path=self.temp_db_path)
        self.assertIsNone(db.get_user_by_session(token, db_path=self.temp_db_path))

    def test_friends_crud_and_balances(self):
        # 1. Crear amigo
        friend = db.create_friend(user_id=1, data={
            'name': 'Pedro Amigo',
            'phone': '+52 55 1111 2222',
            'email': 'pedro@amigo.com'
        }, db_path=self.temp_db_path)
        self.assertEqual(friend['name'], 'Pedro Amigo')
        friend_id = friend['id']

        # 2. Vincular a suscripción compartida
        db.create_subscription({
            'name': 'Netflix Compartido',
            'price': 20.0,
            'billing_cycle': 'monthly',
            'is_shared': 1,
            'shared_with_count': 2,
            'my_share_price': 10.0,
            'shared_friend_ids': str(friend_id)
        }, user_id=1, db_path=self.temp_db_path)

        # 3. Consultar balances
        balances = db.get_friend_balances(user_id=1, db_path=self.temp_db_path)
        pedro_bal = next(b for b in balances if b['friend']['id'] == friend_id)
        self.assertEqual(pedro_bal['monthly_total_owed'], 10.0)
        self.assertEqual(len(pedro_bal['shared_subscriptions']), 1)

        # 4. Registrar pago de amigo
        pay = db.record_friend_payment(user_id=1, friend_id=friend_id, amount=10.0, notes='Transferencia', db_path=self.temp_db_path)
        self.assertEqual(pay['amount'], 10.0)

        # 5. Eliminar amigo
        deleted = db.delete_friend(friend_id, user_id=1, db_path=self.temp_db_path)
        self.assertTrue(deleted)

class TestDatabaseOperations(unittest.TestCase):
    def setUp(self):
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix='.db')
        db.init_db(self.temp_db_path)

    def tearDown(self):
        os.close(self.temp_db_fd)
        if os.path.exists(self.temp_db_path):
            os.remove(self.temp_db_path)

    def test_multicurrency_subscriptions_and_stats(self):
        # Crear usuario para test
        user = db.register_user('multi_user', 'password123', db_path=self.temp_db_path)
        uid = user['id']

        # Divisa base por defecto es USD
        # Agregar sub 1: Netflix en USD (10 USD / mes)
        db.create_subscription({
            'name': 'Netflix USD',
            'price': 10.0,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': '2026-10-01',
            'category': 'Streaming'
        }, user_id=uid, db_path=self.temp_db_path)

        # Agregar sub 2: Internet en DOP (1200 DOP / mes, con tasa 60 => 20 USD / mes)
        db.create_subscription({
            'name': 'Internet DOP',
            'price': 1200.0,
            'currency': 'DOP',
            'billing_cycle': 'monthly',
            'next_billing_date': '2026-10-05',
            'category': 'Servicios'
        }, user_id=uid, db_path=self.temp_db_path)

        subs = db.get_all_subscriptions(user_id=uid, db_path=self.temp_db_path)
        self.assertEqual(len(subs), 2)

        # Verificar conversiones a divisa base (USD)
        net = next(s for s in subs if s['name'] == 'Netflix USD')
        inet = next(s for s in subs if s['name'] == 'Internet DOP')

        self.assertEqual(net['converted_monthly_cost'], 10.0)
        self.assertEqual(inet['converted_monthly_cost'], 20.0)

        # Verificar stats globales en USD
        stats = db.get_stats(user_id=uid, db_path=self.temp_db_path)
        # Total mensual debe ser 10 USD + 20 USD = 30 USD
        self.assertEqual(stats['total_monthly_cost'], 30.0)
        # Top expensive: Internet DOP (20 USD/mes = 240/año) debe ser más costosa que Netflix (10 USD/mes = 120/año)
        self.assertEqual(stats['top_expensive'][0]['name'], 'Internet DOP')

        # Ahora cambiar divisa base del usuario a DOP
        db.update_settings({'base_currency': 'DOP'}, user_id=uid, db_path=self.temp_db_path)
        subs_dop = db.get_all_subscriptions(user_id=uid, db_path=self.temp_db_path)
        net_dop = next(s for s in subs_dop if s['name'] == 'Netflix USD')
        inet_dop = next(s for s in subs_dop if s['name'] == 'Internet DOP')

        # 10 USD = 600 DOP
        self.assertEqual(net_dop['converted_monthly_cost'], 600.0)
        # 1200 DOP = 1200 DOP
        self.assertEqual(inet_dop['converted_monthly_cost'], 1200.0)

        stats_dop = db.get_stats(user_id=uid, db_path=self.temp_db_path)
        self.assertEqual(stats_dop['total_monthly_cost'], 1800.0)
        self.assertEqual(stats_dop['base_currency'], 'DOP')

    def test_crud_subscription(self):
        sub_data = {
            'name': 'Servicio Test',
            'price': 25.0,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': (date.today() + timedelta(days=3)).isoformat(),
            'category': 'Software',
            'status': 'active'
        }
        created = db.create_subscription(sub_data, db_path=self.temp_db_path)
        self.assertIsNotNone(created)
        self.assertEqual(created['name'], 'Servicio Test')
        self.assertEqual(created['price'], 25.0)

        sub_id = created['id']
        updated = db.update_subscription(sub_id, {'price': 30.0, 'billing_cycle': 'quarterly'}, db_path=self.temp_db_path)
        self.assertEqual(updated['price'], 30.0)

        deleted = db.delete_subscription(sub_id, db_path=self.temp_db_path)
        self.assertTrue(deleted)

    def test_calendar_ics_generation(self):
        db.create_subscription({
            'name': 'Servicio Calendario',
            'price': 12.50,
            'currency': 'USD',
            'billing_cycle': 'monthly',
            'next_billing_date': '2026-10-15',
            'is_trial': 1,
            'trial_end_date': '2026-10-10'
        }, db_path=self.temp_db_path)

        ics = db.generate_ics_calendar(db_path=self.temp_db_path)
        self.assertIn("BEGIN:VCALENDAR", ics)
        self.assertIn("Servicio Calendario", ics)
        self.assertIn("CANCELAR PRUEBA", ics)

class TestServerAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = find_free_port()
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        db.init_db()
        cls.httpd = server.http.server.ThreadingHTTPServer(('127.0.0.1', cls.port), server.SubscriptionAPIHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_api_auth_and_friends(self):
        # 1. Login con admin por defecto
        login_data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode('utf-8')
        req = urllib.request.Request(f"{self.base_url}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(res['success'])
            token = res['token']

        # 2. GET /api/auth/me con token
        me_req = urllib.request.Request(f"{self.base_url}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(me_req) as resp:
            self.assertEqual(resp.status, 200)
            me_res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(me_res['authenticated'])
            self.assertEqual(me_res['user']['username'], 'admin')

        # 3. POST /api/friends
        new_friend = json.dumps({'name': 'Amigo API Test', 'phone': '+123456789'}).encode('utf-8')
        f_req = urllib.request.Request(f"{self.base_url}/api/friends", data=new_friend, headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}, method="POST")
        with urllib.request.urlopen(f_req) as resp:
            self.assertEqual(resp.status, 201)
            f_res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(f_res['success'])
            friend_id = f_res['data']['id']

        # 4. GET /api/friends
        list_req = urllib.request.Request(f"{self.base_url}/api/friends", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(list_req) as resp:
            self.assertEqual(resp.status, 200)
            l_res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(any(f['id'] == friend_id for f in l_res['data']))

        # 5. DELETE /api/friends/:id
        del_req = urllib.request.Request(f"{self.base_url}/api/friends/{friend_id}", headers={"Authorization": f"Bearer {token}"}, method="DELETE")
        with urllib.request.urlopen(del_req) as resp:
            self.assertEqual(resp.status, 200)

    def test_social_friend_requests_and_split_pay(self):
        # Crear segundo usuario con username único para soportar múltiples corridas
        import time
        unique_user = f"pedro_{int(time.time()*1000)}"
        reg_data = json.dumps({'username': unique_user, 'password': 'password123', 'display_name': 'Pedro Pascal', 'email': f'{unique_user}@example.com'}).encode('utf-8')
        r_req = urllib.request.Request(f"{self.base_url}/api/auth/register", data=reg_data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(r_req) as resp:
            pedro_res = json.loads(resp.read().decode('utf-8'))
            pedro_token = pedro_res['token']
            pedro_id = pedro_res['user']['id']

        # Obtener token de admin
        login_data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode('utf-8')
        l_req = urllib.request.Request(f"{self.base_url}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(l_req) as resp:
            admin_token = json.loads(resp.read().decode('utf-8'))['token']

        # 1. Admin busca a pedro
        s_req = urllib.request.Request(f"{self.base_url}/api/users/search?q={unique_user}", headers={"Authorization": f"Bearer {admin_token}"})
        with urllib.request.urlopen(s_req) as resp:
            s_res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(s_res['success'])
            self.assertTrue(any(u['username'] == unique_user for u in s_res['data']))

        # 2. Admin envía solicitud de amistad a pedro
        fr_data = json.dumps({'receiver': unique_user}).encode('utf-8')
        fr_req = urllib.request.Request(f"{self.base_url}/api/friends/request", data=fr_data, headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}, method="POST")
        with urllib.request.urlopen(fr_req) as resp:
            self.assertEqual(resp.status, 201)
            fr_res = json.loads(resp.read().decode('utf-8'))
            request_id = fr_res['data']['id']

        # 3. Pedro revisa solicitudes recibidas
        inbox_req = urllib.request.Request(f"{self.base_url}/api/friends/requests", headers={"Authorization": f"Bearer {pedro_token}"})
        with urllib.request.urlopen(inbox_req) as resp:
            inbox_res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(inbox_res['success'])
            self.assertTrue(any(r['id'] == request_id for r in inbox_res['data']['received']))

        # 4. Pedro acepta la solicitud
        resp_data = json.dumps({'request_id': request_id, 'action': 'accept'}).encode('utf-8')
        acc_req = urllib.request.Request(f"{self.base_url}/api/friends/respond-request", data=resp_data, headers={"Content-Type": "application/json", "Authorization": f"Bearer {pedro_token}"}, method="POST")
        with urllib.request.urlopen(acc_req) as resp:
            self.assertEqual(resp.status, 200)

        # 5. Ambos deben tenerse en amigos vinculados
        list_req = urllib.request.Request(f"{self.base_url}/api/friends", headers={"Authorization": f"Bearer {admin_token}"})
        with urllib.request.urlopen(list_req) as resp:
            friends_admin = json.loads(resp.read().decode('utf-8'))['data']
            self.assertTrue(any(f.get('linked_user_id') == pedro_id for f in friends_admin))

        # 6. Admin solicita a Pedro pagar en conjunto ($7.50 de Spotify)
        split_data = json.dumps({
            'friend_user_id': pedro_id,
            'amount': 7.50,
            'currency': 'USD',
            'notes': 'Mitad de Spotify Dúo'
        }).encode('utf-8')
        sp_req = urllib.request.Request(f"{self.base_url}/api/friends/split-request", data=split_data, headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}, method="POST")
        with urllib.request.urlopen(sp_req) as resp:
            self.assertEqual(resp.status, 201)
            sp_res = json.loads(resp.read().decode('utf-8'))
            split_req_id = sp_res['data']['id']

        # 7. Pedro ve la solicitud de pago recibida
        sp_list_req = urllib.request.Request(f"{self.base_url}/api/friends/split-requests", headers={"Authorization": f"Bearer {pedro_token}"})
        with urllib.request.urlopen(sp_list_req) as resp:
            sp_list_res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(any(r['id'] == split_req_id for r in sp_list_res['data']['received']))

        # 8. Pedro confirma el pago
        sp_resp_data = json.dumps({'request_id': split_req_id, 'action': 'paid'}).encode('utf-8')
        pay_conf_req = urllib.request.Request(f"{self.base_url}/api/friends/split-requests/respond", data=sp_resp_data, headers={"Content-Type": "application/json", "Authorization": f"Bearer {pedro_token}"}, method="POST")
        with urllib.request.urlopen(pay_conf_req) as resp:
            self.assertEqual(resp.status, 200)

        # 9. Verificar consulta de suscripciones mutuas (/api/friends/shared-subs)
        pedro_friend_entry = next(f for f in friends_admin if f.get('linked_user_id') == pedro_id)
        shared_subs_req = urllib.request.Request(f"{self.base_url}/api/friends/shared-subs?friend_id={pedro_friend_entry['id']}", headers={"Authorization": f"Bearer {admin_token}"})
        with urllib.request.urlopen(shared_subs_req) as resp:
            self.assertEqual(resp.status, 200)
            sh_res = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(sh_res['success'])
            self.assertTrue(sh_res['data']['is_linked'])
            self.assertIn('my_subscriptions', sh_res['data'])
            self.assertIn('friend_subscriptions', sh_res['data'])

if __name__ == '__main__':
    unittest.main()
