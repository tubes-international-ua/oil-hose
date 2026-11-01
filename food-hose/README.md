# Харчові шланги — food-hose.tubes-international.com.ua

Окремий Worker `food-hose` у цьому репозиторії. Код Worker'а спільний з лендінгом композитних
рукавів (`../src/index.js`): статика з `public/` + обробник форми `POST /api/lead`.
Заявки приходять з темою «харчові шланги» (`form_name: food_hoses_landing`).

## Сторінки
| Адреса | Файл |
|---|---|
| `/` | `public/index.html` — лендінг |
| `/catalog` | `public/catalog.html` — 52 моделі з фільтром (`/catalog#milk`, `#silicone`, …) |
| `/product?p=<slug>` | `public/product.html` — сторінка товару, дані в `public/js/food-products.js` |
| `/privacy` | `public/privacy.html` |

Дизайн той самий, що в лендінгу композитних рукавів: `public/css/styles.css` — копія
`../public/assets/css/styles.css` (не правити тут; після змін там — скопіювати заново).
Специфічне для харчового сайту (каталог, фільтри, картки товарів, сторінка товару) — у `scss/food.scss`,
потім `npx sass --no-source-map scss/food.scss public/css/food.css`.

## Публікація (один раз)
1. **Workers & Pages → Create → Import a repository** → `tubes-international-ua/oil-hose`.
   У налаштуваннях збірки **Root directory = `food-hose`**, Deploy command `npx wrangler deploy`.
   Назва Worker'а береться з `food-hose/wrangler.jsonc` (`food-hose`).
2. Домен `food-hose.tubes-international.com.ua` прив'язується сам через `routes` у `wrangler.jsonc`
   (зона `tubes-international.com.ua` уже в Cloudflare).
3. Секрет для пошти — у **цього** Worker'а окремо від `oil-hose`:
   ```bash
   cd food-hose && npx wrangler secret put RESEND_API_KEY
   ```
4. Перевірити тестову заявку. Поки в `wrangler.jsonc` задано `MAIL_TO`, усі заявки йдуть
   на `tubes.marketing.ua@gmail.com`; приберіть змінну, щоб повернути розподіл по філіях.

Локально: `cd food-hose && npx wrangler dev`.

## Аналітика
GTM-5D7K38NV (той самий контейнер). Події `dataLayer`: `generate_lead` (`form_name: food_hoses_landing`),
`phone_click`, `form_error`. Теги конверсій Google Ads у GTM ще треба створити.
Сторінки закриті від індексу (`noindex, follow`), як і лендінг композитних рукавів.
