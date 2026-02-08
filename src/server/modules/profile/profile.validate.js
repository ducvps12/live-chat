const Joi = require('joi');

const updateProfile = Joi.object({
    firstName: Joi.string().max(100).optional(),
    lastName: Joi.string().max(100).optional(),
    language: Joi.string().max(10).optional(),
    timezone: Joi.string().max(50).optional()
});

module.exports = {
    updateProfile
};
