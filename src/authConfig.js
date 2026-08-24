export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority:
      `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: window.location.origin + "/js-resource-booking/",
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};
