export function djb2(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) + h + text.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}
