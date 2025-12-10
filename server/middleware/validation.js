
/**
 * Middleware to validate required fields in request body.
 * @param {string[]} fields 
 */
export const validateRequired = (fields) => (req, res, next) => {
    const missing = fields.filter(field => {
        const value = req.body[field];
        return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
        return res.status(400).json({
            error: `Missing required fields: ${missing.join(', ')}`
        });
    }
    next();
};
