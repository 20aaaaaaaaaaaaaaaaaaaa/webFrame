export const getMediaDuration = (url: string, type: 'video' | 'audio' | 'image'): Promise<number> => {
    return new Promise((resolve) => {
        if (type === 'image') {
            resolve(5); // Default for images
            return;
        }

        const element = type === 'video' ? document.createElement('video') : document.createElement('audio');
        element.src = url;
        element.preload = 'metadata';

        element.onloadedmetadata = () => {
            resolve(element.duration);
        };

        element.onerror = () => {
            resolve(5); // Fallback
        };
    });
};
