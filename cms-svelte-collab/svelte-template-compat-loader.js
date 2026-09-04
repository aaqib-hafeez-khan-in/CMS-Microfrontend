module.exports = function svelteTemplateCompatLoader(source) {
  return source.replace(/\(event\.currentTarget as HTMLTextAreaElement\)\.value/g, 'event.currentTarget.value');
};
