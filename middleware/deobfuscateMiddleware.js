import { deobfuscateId } from '../utils/idObfuscator.js';

/**
 * Global middleware that decrypts obfuscated projectId/id values in
 * req.body and req.query (populated before route matching).
 *
 * Route path params (:id, :projectId) are handled separately via
 * app.param() hooks in server.js, since req.params is only populated
 * after a route is matched.
 */
export const deobfuscateMiddleware = (req, res, next) => {
  // Decrypt in req.query
  if (req.query) {
    if (req.query.projectId) {
      req.query.projectId = deobfuscateId(req.query.projectId);
    }
    if (req.query.id) {
      req.query.id = deobfuscateId(req.query.id);
    }
  }

  // Decrypt in req.body
  if (req.body) {
    if (req.body.projectId) {
      req.body.projectId = deobfuscateId(req.body.projectId);
    }
    if (req.body.id) {
      req.body.id = deobfuscateId(req.body.id);
    }
  }

  next();
};

export default deobfuscateMiddleware;
