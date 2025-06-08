import joi from "joi";

export const registerSchema = joi
  .object({
    name: joi.string().min(3).max(255).required(),
    email: joi.string().email().required(),
    password: joi
      .string()
      .min(8)
      .pattern(
          new RegExp(
              "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
            )
        ).messages({
            'string.pattern.base': "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character."
        })
        .required(),
  })
  export const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().required(),
  });
  export const changePasswordSchema = joi.object({
    currentPassword: joi.string().required(),
    newPassword: joi
      .string()
      .min(8)
      .pattern(
          new RegExp(
              "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
            )
        ).invalid(joi.ref('currentPassword'))
        .messages({"string.pattern.base": "New password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.",
            "any.invalid": "New password must be different from the current password."
        }
        )
        .required(),
  });

