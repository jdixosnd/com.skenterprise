import { useState, useRef } from 'react';
import '../styles/CameraCapture.css';

const CameraCapture = ({ onCapture, onClose }) => {
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const canvasRef = useRef(null);

  const retakePhoto = () => {
    setCapturedImage(null);
    setUploadedFile(null);
  };

  const confirmPhoto = () => {
    // If user uploaded a file, use that directly
    if (uploadedFile) {
      onCapture(uploadedFile, capturedImage);
      return;
    }

    // Otherwise, convert canvas to blob for camera captures
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        const file = new File([blob], 'design-photo.jpg', { type: 'image/jpeg' });
        onCapture(file, capturedImage);
      }, 'image/jpeg', 0.8);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Store the original file
      setUploadedFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          canvas.width = img.width;
          canvas.height = img.height;
          const context = canvas.getContext('2d');
          context.drawImage(img, 0, 0);

          const imageUrl = e.target.result;
          setCapturedImage(imageUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="camera-modal">
      <div className="camera-container">
        <div className="camera-header">
          <h3>Upload Design Photo</h3>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        {error && (
          <div className="camera-error">
            {error}
          </div>
        )}

        <div className="camera-preview">
          {!capturedImage ? (
            <>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="upload-placeholder">
                <span className="upload-icon">📤</span>
                <p>Select an image to preview</p>
              </div>
            </>
          ) : (
            <img src={capturedImage} alt="Preview" className="captured-image" />
          )}
        </div>

        <div className="camera-controls">
          {!capturedImage ? (
            <label className="btn-upload-primary">
              ↑ Choose Image
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
          ) : (
            <>
              <button onClick={retakePhoto} className="btn-retake">
                ← Retake
              </button>
              <button onClick={confirmPhoto} className="btn-confirm">
                ✓ Use Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
