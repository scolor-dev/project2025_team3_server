# project2025_team3_server
## Express + SQLite API


使い方：
1. `.env.example` を `.env` にコピーし、必要に応じて編集
2. `npm install`
3. `npm run dev` または `npm start`


提供API（主なもの）：
- POST /auth/login { email, password } -> { token }
- POST /auth/logout (Authorization: Bearer <token>)
- GET /users/:id
- GET /diary/month/:YYYY-MM (認証必要)
- GET /diary/day/:YYYY-MM-DD (認証必要)
- GET /diary/:id (認証必要)
- POST /diary (作成)、PUT /diary/:id、DELETE /diary/:id


注意点：
- 本サンプルは実用的な最小構成です。プロダクションではHTTPS、トークン有効期限、より堅牢なログ・エラーハンドリング、レート制限等を追加してください。