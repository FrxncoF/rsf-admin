/** Escapa los comodines de LIKE para buscar el texto tal cual. */
export const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
