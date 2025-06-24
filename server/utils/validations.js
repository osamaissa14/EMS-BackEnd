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
    role: joi.string().valid('student', 'instructor', 'admin').default('student')
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

export const updateProfileSchema = joi.object({
  name: joi.string().min(3).max(255),
  email: joi.string().email(),
});

export const forgotPasswordSchema = joi.object({
  email: joi.string().email().required(),
});

export const resetPasswordSchema = joi.object({
  token: joi.string().required(),
  newPassword: joi
    .string()
    .min(8)
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
      )
    )
    .messages({
      'string.pattern.base': "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character."
    })
    .required(),
});

export const adminRegisterSchema = joi.object({
  name: joi.string().min(3).max(255).required(),
  email: joi.string().email().required(),
  password: joi
    .string()
    .min(10) // Stronger password for admin
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{10,}$"
      )
    )
    .messages({
      'string.pattern.base': "Admin password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character, and be at least 10 characters long."
    })
    .required()
});

