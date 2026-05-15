const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

class TemplateEngine {
  constructor(baseDir = path.join(__dirname, 'templates')) {
    this.baseDir = baseDir;
    this.cache = new Map();
    this.defaultSet = 'default';
  }

  /**
   * Resuelve la ruta de una plantilla.
   * - templateRef: "conjunto:nombre.ejs" o "nombre.ejs"
   * - contextSet: string o array de strings con los conjuntos activos (en orden de prioridad).
   */
  resolveTemplate(templateRef, contextSet = null) {
    let [setName, templateName] = templateRef.includes(':')
      ? templateRef.split(':')
      : [null, templateRef];

    // Si se especificó conjunto explícito (ej. emails:welcome), solo buscamos ahí (+ fallback default)
    if (setName) {
      const setsToTry = [setName];
      if (setName !== this.defaultSet) setsToTry.push(this.defaultSet);
      for (const set of setsToTry) {
        const filePath = path.join(this.baseDir, set, templateName);
        if (fs.existsSync(filePath)) return filePath;
      }
      throw new Error(`Plantilla no encontrada: ${templateRef} (buscada en ${setsToTry.join(', ')})`);
    }

    // Si no, usamos la lista de contextSet (array) o un solo conjunto
    const setsToTry = Array.isArray(contextSet) ? [...contextSet] : [contextSet || this.defaultSet];
    // Aseguramos que siempre esté el default al final como último recurso
    if (!setsToTry.includes(this.defaultSet)) {
      setsToTry.push(this.defaultSet);
    }

    for (const set of setsToTry) {
      const filePath = path.join(this.baseDir, set, templateName);
      if (fs.existsSync(filePath)) return filePath;
    }

    throw new Error(`Plantilla no encontrada: ${templateRef} (buscada en ${setsToTry.join(', ')})`);
  }

  async getTemplate(templateRef, contextSet) {
    const filePath = this.resolveTemplate(templateRef, contextSet);
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }
    const templateStr = await fs.promises.readFile(filePath, 'utf-8');
    const compiled = ejs.compile(templateStr, { filename: filePath, async: true });
    this.cache.set(filePath, compiled);
    return compiled;
  }

  async render(templateRef, data = {}, contextSet = null) {
    const template = await this.getTemplate(templateRef, contextSet);
    const renderData = {
      ...data,
      include: async (partialRef, partialData = {}) => {
        const merged = { ...data, ...partialData };
        return this.render(partialRef, merged, contextSet);
      }
    };
    return template(renderData);
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = TemplateEngine;