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
