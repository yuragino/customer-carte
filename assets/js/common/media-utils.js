import { CLOUDINARY_CONFIG } from './constants.js';

export async function uploadMediaToCloudinary(file, folderName) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
  formData.append('folder', folderName);

  const resourceType = file.type.startsWith('image/') ? 'image' : 'video';
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/${resourceType}/upload`;

  const response = await fetch(url, { method: 'POST', body: formData });
  if (!response.ok) throw new Error('Cloudinaryへのアップロードに失敗しました。');

  const data = await response.json();
  return data.secure_url;
}

// 配列で渡してアップロード
export async function uploadMediaArrayToCloudinary(files, folderName) {
  if (!files || files.length === 0) return [];
  const uploadPromises = files.map(file =>
    uploadMediaToCloudinary(file, folderName)
  );
  return await Promise.all(uploadPromises);
}

export function prepareMediaPreviewUtil(event, type, targetObj) {
  const selectedFiles = [...event.target.files];
  if (!selectedFiles.length) return;
  const previews = selectedFiles.map(file => URL.createObjectURL(file));
  if (type === 'image') {
    targetObj.newImageFiles ||= [];
    targetObj.newImagePreviews ||= [];
    targetObj.newImageFiles.push(...selectedFiles);
    targetObj.newImagePreviews.push(...previews);
  } else {
    targetObj.newVideoFiles ||= [];
    targetObj.newVideoPreviews ||= [];
    targetObj.newVideoFiles.push(...selectedFiles);
    targetObj.newVideoPreviews.push(...previews);
  }
  event.target.value = '';
}

export function removeMediaUtil(mediaType, index, targetObj) {
  if (!confirm('このメディアを削除しますか？')) return;
  switch (mediaType) {
    case 'saved-image':
      targetObj.imageUrls.splice(index, 1);
      break;
    case 'saved-video':
      targetObj.videoUrls.splice(index, 1);
      break;
    case 'new-image':
      URL.revokeObjectURL(targetObj.newImagePreviews[index]);
      targetObj.newImageFiles.splice(index, 1);
      targetObj.newImagePreviews.splice(index, 1);
      break;
    case 'new-video':
      URL.revokeObjectURL(targetObj.newVideoPreviews[index]);
      targetObj.newVideoFiles.splice(index, 1);
      targetObj.newVideoPreviews.splice(index, 1);
      break;
  }
}
