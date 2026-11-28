
  function applyPicture() {
    if (!settings.pictureOn) { root.removeAttribute('data-delve-picture'); return; }
    const { brightness, contrast, saturation, dim, pictureZoom, pictureWidth, pictureHeight, alignX, alignY } = settings;
    root.style.setProperty('--delve-picture-filter', `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) brightness(${100 - dim}%)`);
    root.style.setProperty('--delve-picture-scale-x', pictureZoom * pictureWidth / 10000);
    root.style.setProperty('--delve-picture-scale-y', pictureZoom * pictureHeight / 10000);
    root.style.setProperty('--delve-picture-align', `${alignX}% ${alignY}%`);
    root.setAttribute('data-delve-picture', '');
    updatePictureCrop();
    syncPicturePanel();
  }
  // The crop box is the largest rectangle of the chosen shape that fits the video element, centered. The picture is scaled
  // to fill it (the overflow is clipped) or to fit inside it. The clip is in the element's own coordinates, before the scale.
  const NO_CROP = { cropScale: 1, insetX: 0, insetY: 0 };
  function pictureCropGeometry(video) {
    const aspect = PICTURE_CROPS.find(([key]) => key === settings.pictureCrop)[2];
    if (!aspect || !video || !video.videoWidth || !video.clientWidth || !video.clientHeight) return NO_CROP;
    const { clientWidth: frameWidth, clientHeight: frameHeight } = video;
    const pictureScale = Math.min(frameWidth / video.videoWidth, frameHeight / video.videoHeight);
    const pictureWidth = video.videoWidth * pictureScale, pictureHeight = video.videoHeight * pictureScale;
    const boxWidth = Math.min(frameWidth, frameHeight * aspect), boxHeight = boxWidth / aspect;
    const [widthRatio, heightRatio] = [boxWidth / pictureWidth, boxHeight / pictureHeight];
    const cropScale = settings.pictureCropFit === 'fit' ? Math.min(widthRatio, heightRatio) : Math.max(widthRatio, heightRatio);
    return { cropScale, insetX: (frameWidth - boxWidth / cropScale) / 2, insetY: (frameHeight - boxHeight / cropScale) / 2 };
  }
  function updatePictureCrop() {
    const crop = pictureCropGeometry(document.querySelector('video'));
    root.style.setProperty('--delve-picture-crop-scale', crop.cropScale);
    root.style.setProperty('--delve-picture-crop-clip', crop === NO_CROP ? 'none' : `inset(${crop.insetY}px ${crop.insetX}px)`);
    placeWatermark();
  }

