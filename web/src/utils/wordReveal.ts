/**
 * 点单词：第一次只发音，第二次显示释义，第三次收起（下一轮重新从发音开始）。
 */
export function nextWordTapState(opts: {
  showTranslation: boolean;
  heard: boolean;
}): { heard: boolean; showTranslation: boolean; shouldPlay: boolean } {
  if (opts.showTranslation) {
    return { heard: false, showTranslation: false, shouldPlay: false };
  }
  if (!opts.heard) {
    return { heard: true, showTranslation: false, shouldPlay: true };
  }
  return { heard: true, showTranslation: true, shouldPlay: false };
}
