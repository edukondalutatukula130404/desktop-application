Read the uploaded prd.md and trd.md files completely before making any changes.

Use these two documents as the source of truth for the InvoicePro Login Page project.

IMPORTANT:

1. Follow prd.md for all product and UI requirements.
2. Follow trd.md for all technical and architecture requirements.
3. Build the project using React.js + Node.js + Express.js + MongoDB.
4. Keep frontend and backend in separate folders.
5. Implement the LIGHT THEME InvoicePro login design.
6. Do not redesign or change the approved UI.
7. Make the page fully responsive for desktop, tablet, and mobile.
8. Use reusable React components.
9. Implement proper frontend validation.
10. Implement backend authentication.
11. Hash passwords using bcrypt.
12. Never store plain-text passwords.
13. Never expose passwords, JWT secrets, database credentials, or other secrets.
14. Use environment variables for configuration.
15. Use secure HTTP-only authentication cookies.
16. Implement login, logout, current-user, forgot-password, and reset-password API structure.
17. Implement protected routing for the dashboard.
18. Implement loading, validation, authentication-error, and network-error states.
19. Add Google and Microsoft login UI as placeholders until OAuth credentials are configured.
20. Do not use fake authentication as the final implementation.

FIRST:

Analyze:
- prd.md
- trd.md
- existing project files

Then create or modify the project files.

Use this structure:

invoicepro-login/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── prd.md
│   └── trd.md
│
├── .gitignore
└── README.md

Before finishing:

- Install all required dependencies.
- Make sure frontend starts successfully.
- Make sure backend starts successfully.
- Check for compilation errors.
- Check for console errors.
- Check responsive behavior.
- Check form validation.
- Check password show/hide.
- Check login API communication.
- Check authentication handling.
- Check protected routes.
- Check security configuration.

Do not ask me to manually create individual files unless absolutely necessary.

Build the complete working project based on the uploaded PRD and TRD.