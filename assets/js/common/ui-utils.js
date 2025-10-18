export function toggleRadioUtil(event, modelName, targetObj) {
  const clickedValue = event.target.value;
  if (targetObj[modelName] === clickedValue) {
    setTimeout(() => { targetObj[modelName] = null; }, 0);
  } else {
    targetObj[modelName] = clickedValue;
  }
}
