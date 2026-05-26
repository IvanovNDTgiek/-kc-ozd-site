import { isMailConfigured, sendContactNotification } from '../server/mail.js';

if (!isMailConfigured()) {
  process.stderr.write(
    'SMTP не настроен. Заполните SMTP_HOST, SMTP_USER и SMTP_PASS в .env (пароль приложения Google).\n',
  );
  process.exit(1);
}

var result = await sendContactNotification({
  id: 0,
  name: 'Тест',
  email: process.env.SMTP_USER || 'test@example.com',
  phone: '+7 900 000-00-00',
  message: 'Проверка отправки с сайта КЦ ОЖД. Если письмо пришло — почта настроена верно.',
});

if (result.sent) {
  process.stdout.write('Тестовое письмо отправлено на ' + (process.env.CONTACT_EMAIL_TO || 'kcozdofficial@gmail.com') + '\n');
} else {
  process.stderr.write('Письмо не отправлено: ' + (result.error || 'unknown') + '\n');
  process.exit(1);
}
