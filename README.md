# Learning Task Ranking — Setup

Ab structure aise hai:
- **Code.gs** → Google Apps Script, sirf ek JSON API (backend). Data Google Sheet me store hota hai.
- **index.html, admin.html, script.js, student.js, admin.js** → plain static files (frontend). Yeh files GAS ke andar nahi, bahar kahin bhi rakh sakte ho — apne laptop pe, GitHub Pages pe, Netlify pe, jahan chaho.
- Frontend, backend ko **script.js** me diye gaye `API_URL` ke through fetch() se call karta hai.
- Admin jab student add karta hai (email ke saath), student ko uska unique **code seedha email pe** chala jata hai (Gmail ke through, GAS ki `MailApp` service se).

## Part 1 — Backend (Google Apps Script)

1. Ek nayi Google Sheet banao (sheets.google.com → Blank).
2. **Extensions → Apps Script** open karo.
3. Default `Code.gs` delete karke is repo ka `Code.gs` paste kar do.
4. Top dropdown se function `setupSheets` select karo, **Run** dabao. Permission maangega — Allow karo.
   - Yeh 4 sheets bana dega: `Students`, `Tasks`, `Scores`, `Config`.
5. Sheet me `Config` tab open karo:
   - `AdminPassword` ki value `changeme123` se apna password kar do.
   - `StudentPageURL` abhi khali/placeholder rehne do — Part 2 khatam hone ke baad yahan wapas aake bharoge.
6. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy dabao, **URL jo `/exec` pe khatam hoti hai** copy kar lo. Yahi tumhara `API_URL` hai.

## Part 2 — Frontend (static files)

1. `script.js` file kholo, sabse upar yeh line dikhegi:
   ```js
   const API_URL = "PASTE_YOUR_WEB_APP_URL_HERE";
   ```
   Isme apna Part-1 wala `/exec` URL paste kar do.
2. `index.html`, `admin.html`, `script.js`, `student.js`, `admin.js` — in paanch files ko **ek hi folder me** rakho, kahin bhi host kar do:
   - Sabse simple: seedha `index.html` double-click karke browser me kholo (local use ke liye chalega).
   - Ya GitHub Pages / Netlify pe folder upload kar do taaki students ek public link se access kar saken.
3. Jahan bhi host karo, wahan ka `index.html` ka final URL copy karo.
4. Wapas Google Sheet ke `Config` tab me jao, `StudentPageURL` me yeh URL paste kar do (yeh URL admin ke bheje email me student ko jayega).

## Links

- **Students ko do:** hosted `index.html` ka URL (ya file seedha open kare)
- **Sirf apne paas rakho:** hosted `admin.html` ka URL (password-protected hai, phir bhi link share mat karo)

## Kaam kaise karta hai

- **Students sheet**: `Code | Name | Email | TotalPoints` (total auto-calculate hota hai).
- **Tasks sheet**: admin panel se add kiye gaye tasks (naam, video link, max points).
- **Scores sheet**: kis student ko kis task pe kitne points mile.
- **Config sheet**: `AdminPassword` aur `StudentPageURL`.

Admin panel (`admin.html`) se:
- Student add karo (code + name + email) → **email daalte hi student ko uska code mail ho jata hai**, saath me student page ka link bhi.
- Task add/remove kar sakte ho.
- Kisi bhi student ko kisi bhi task pe points assign/update kar sakte ho — turant total aur leaderboard recalculate ho jata hai.

Student (`index.html`) apna code daal ke apni ranking, total points, aur task-wise breakdown dekh sakta hai — poori leaderboard bhi dikhti hai (apni row highlight hoti hai).

## Notes

- Email `MailApp.sendEmail` se jaata hai — GAS jis Google account se deploy hua hai, usi ke Gmail se bhejta hai. Free Gmail account ki daily limit ~100 emails/day hai (Workspace me zyada).
- Login sirf code-based hai (password nahi) — classroom ke liye kaafi hai. Jisko code pata hai wo us student ke roop me dekh sakta hai, isliye codes students ke beech share mat karwao.
- Admin password kabhi frontend code me hardcoded nahi hai — har admin action server pe dobara verify hota hai.
- Agar `admin.html` ya `index.html` "API_URL not set" bataye, matlab `script.js` me URL paste karna reh gaya (Part 2, step 1).
