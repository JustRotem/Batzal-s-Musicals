export type ChangePasswordFormState = {
  status: "idle" | "success" | "error";
  fieldErrors: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  formError?: string;
  successMessage?: string;
};

export const INITIAL_CHANGE_PASSWORD_STATE: ChangePasswordFormState = {
  status: "idle",
  fieldErrors: {},
};

export type ResetPasswordFormState = {
  status: "idle" | "error";
  fieldErrors: {
    password?: string;
    confirmPassword?: string;
  };
  formError?: string;
};

export const INITIAL_RESET_PASSWORD_STATE: ResetPasswordFormState = {
  status: "idle",
  fieldErrors: {},
};

export type ForgotPasswordFormState = {
  status: "idle" | "success" | "error";
  email: string;
  fieldError?: string;
  formError?: string;
  message?: string;
};

export const INITIAL_FORGOT_PASSWORD_STATE: ForgotPasswordFormState = {
  status: "idle",
  email: "",
};

export type LoginFormState = {
  status: "idle" | "error";
  email: string;
  errorCode?: string;
  turnstileResetKey: number;
};

export const INITIAL_LOGIN_FORM_STATE: LoginFormState = {
  status: "idle",
  email: "",
  turnstileResetKey: 0,
};
