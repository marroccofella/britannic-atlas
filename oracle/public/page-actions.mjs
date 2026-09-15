// Runtime-owned destinations. Neither a model nor a saved transcript supplies URLs.
export function approvedPage(target) {
  if (target !== 'weather') return null;
  return {target:'weather', title:'Official Isle of Man weather', href:'https://www.gov.im/weather/'};
}
