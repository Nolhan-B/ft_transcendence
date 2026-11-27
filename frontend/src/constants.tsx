// Layout
export const WEBSITE_NAME: string = "SorryNotSorry";
export const WEBSITE_DESCRIPTION: string =
  "A multiplayer game made by nbilyj, nbarbosa, gtourdia & kebertra";

// Usernames: 3 to 20 letters (any language), digits, "_", "." or "-". No
// spaces, so a name can never be blank. Same rule on the server (auth and
// user services, USERNAME_PATTERN). For the "pattern" attribute of inputs.
export const USERNAME_PATTERN =
  "^[\\p{L}\\p{N}][\\p{L}\\p{N}_.\\-]{1,18}[\\p{L}\\p{N}]$";
export const USERNAME_HINT =
  "3 to 20 letters, digits, _ . or -, starting and ending with a letter or digit";

// Pages
export const PRIVACY_PAGE_TITLE: string = "Privacy Policy";
export const TERMS_PAGE_TITLE: string = "Terms";
