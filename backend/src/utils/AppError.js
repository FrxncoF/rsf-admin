export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Solicitud inválida', details) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new AppError(401, message);
  }

  static forbidden(message = 'No tienes permisos para esta acción') {
    return new AppError(403, message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(404, message);
  }

  static conflict(message) {
    return new AppError(409, message);
  }
}
