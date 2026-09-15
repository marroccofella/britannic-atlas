export function usableReviewAnswer(answer){
 const text=String(answer||'').trim();
 return text.length>=3&&!/^(?:test(?:ing)?|todo|placeholder|lorem ipsum|ok(?:ay)?|done|n\/a)[.!?\s]*$/i.test(text)
  && !/^(?:test|dummy|placeholder|sample)\s+(?:answer|response|output)(?:\s+(?:to|for)\s+[^\n]{0,200})?[.!?\s]*$/i.test(text);
}
