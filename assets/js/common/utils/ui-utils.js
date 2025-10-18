export function toggleRadioUtil(event, modelName, targetObj) {
  const clickedValue = event.target.value;
  if (targetObj[modelName] === clickedValue) {
    setTimeout(() => { targetObj[modelName] = null; }, 0);
  } else {
    targetObj[modelName] = clickedValue;
  }
}

export function handleError(context, error) {
  console.error(`${context} エラー:`, error);
  alert(`${context}で問題が発生しました。`);
}
