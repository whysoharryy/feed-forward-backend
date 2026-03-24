/**
 * Joi Validation Middleware Factory
 * Usage: validate(schema) — validates req.body against a Joi schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map(d => d.message).join(', '),
      });
    }

    next();
  };
};

module.exports = validate;
