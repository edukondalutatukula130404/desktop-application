I have uploaded prd.md for my InvoicePro Login Page project.

Read the entire prd.md file first and implement the login page according to the requirements in that document.

IMPORTANT:
- Follow the uploaded PRD as the source of truth.
- Do NOT change the approved UI design.
- Do NOT create a dark theme.
- Use the LIGHT THEME design shown in the reference.
- Make the UI professional, modern, clean, and responsive.
- Do not add unnecessary features that are not required by the PRD.

TECH STACK:
- Frontend: React.js
- Use modern React components.
- Use CSS for styling.
- Do not use a different frontend framework.
- Keep frontend and backend separated.

PROJECT STRUCTURE:

invoicepro-login/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── BrandHeader.jsx
│   │   │   ├── LoginCard.jsx
│   │   │   ├── LoginForm.jsx
│   │   │   ├── InputField.jsx
│   │   │   ├── PasswordInput.jsx
│   │   │   └── SocialLogin.jsx
│   │   ├── pages/
│   │   │   └── LoginPage.jsx
│   │   ├── services/
│   │   │   └── authService.js
│   │   ├── styles/
│   │   │   └── login.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env
│
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   └── authController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   └── authRoutes.js
│   ├── services/
│   │   └── authService.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
└── docs/
    └── prd.md


LOGIN PAGE UI:

Create a centered login experience with:

1. LIGHT BACKGROUND
- Use a very light blue/white background.
- Add subtle blue gradients.
- Add very subtle abstract curves/shapes.
- Add optional dotted decorative elements.
- Do not make the background visually busy.

2. INVOICEPRO BRANDING
At the top center:
- InvoicePro logo/icon
- InvoicePro brand name
- Tagline:
  "Smart Invoicing, Faster Payments"

3. LOGIN CARD
Create a large centered white card.

Card requirements:
- White background
- Rounded corners
- Thin light border
- Soft shadow
- Clean spacing
- Responsive width
- Centered on screen

4. USER ICON
Place a circular user/profile icon overlapping the top border of the login card.

5. WELCOME SECTION

Heading:
"Welcome Back"

Subtitle:
"Login to your account and manage your invoices"

6. EMAIL INPUT

Label:
"Email ID or Username"

Placeholder:
"Enter your email or username"

Include a user icon inside the input.

7. PASSWORD INPUT

Label:
"Password"

Placeholder:
"Enter your password"

Include:
- Lock icon
- Show/hide password button

8. REMEMBER / FORGOT PASSWORD

Left:
☐ Remember me

Right:
Forgot Password?

9. LOGIN BUTTON

Create a full-width blue button:

LOGIN

Use:
- Blue background
- White text
- Rounded corners
- Hover animation
- Active state
- Disabled state
- Loading state

Loading text:
"Logging in..."

10. SOCIAL LOGIN

Below the login button:

"or continue with"

Then create two buttons:

Continue with Google
Continue with Microsoft

11. SIGN UP

At bottom:

"Don't have an account? Sign up"

Make "Sign up" clickable.

COLORS:

Primary blue:
#2563EB

Dark blue:
#1D4ED8

Background:
#F5F8FF

White:
#FFFFFF

Primary text:
#172554

Secondary text:
#64748B

Border:
#D9E2F2

Success:
#22C55E

Error:
#DC2626

TYPOGRAPHY:

Use Inter, Poppins, or Manrope.

Use a clean professional SaaS typography system.

RESPONSIVE REQUIREMENTS:

Desktop:
- Center login card.
- Full branding visible.
- Large comfortable card.
- Decorative background visible.

Tablet:
- Reduce card width and spacing.
- Maintain all functionality.

Mobile:
- Single-column layout.
- Card should fit the screen.
- Reduce decorative elements.
- Inputs should be touch friendly.
- No horizontal scrolling.
- Keep user icon centered.

FUNCTIONALITY:

Implement:
- Controlled email input.
- Controlled password input.
- Password show/hide.
- Remember me checkbox.
- Client-side validation.
- Loading state.
- Login error state.
- Forgot password navigation.
- Sign-up navigation.
- Google/Microsoft buttons as placeholders until OAuth is configured.

VALIDATION:

Empty email:
"Please enter your email or username."

Invalid email:
"Please enter a valid email address."

Empty password:
"Please enter your password."

Invalid credentials:
"Invalid email or password."

Network error:
"Unable to connect to the server. Please try again."

SECURITY:

Do not store passwords in localStorage.

Do not expose passwords in console logs.

Do not hardcode secrets.

Use environment variables for API configuration.

Prepare the frontend for a backend authentication API.

API endpoint:

POST /api/auth/login

Request:

{
  "identifier": "user@example.com",
  "password": "password",
  "rememberMe": true
}

Successful login should redirect to:

/dashboard

Do not implement fake authentication as the final solution.

ACCESSIBILITY:

- Proper labels for all inputs.
- Keyboard navigation.
- Visible focus states.
- Accessible buttons.
- Accessible password visibility control.
- Proper error messages.
- Good color contrast.

CODE QUALITY:

- Use reusable React components.
- Avoid duplicated code.
- Keep components small and maintainable.
- Keep styling organized.
- Use semantic HTML.
- Do not put everything inside App.jsx.
- Add comments only where useful.
- Do not change the existing design while implementing functionality.

BEFORE FINISHING:

1. Check the entire PRD.
2. Verify every UI requirement.
3. Verify responsive behavior.
4. Verify form validation.
5. Verify password visibility.
6. Verify loading state.
7. Verify error states.
8. Verify navigation.
9. Check for console errors.
10. Make sure the application runs successfully.

After implementation, provide:
- Files created/modified
- Installation commands
- Run commands
- Any environment variables required
- Any remaining backend/OAuth configuration required