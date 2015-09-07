# ###########################################
# Main source:
# -----------
# http://stackoverflow.com/questions/13211745/detect-face-then-autocrop-pictures
#
# Other helpful sources:
# ---------------------
# http://opencv.willowgarage.com/documentation/python/cookbook.html
# http://www.lucaamore.com/?p=638
# http://stackoverflow.com/questions/14134892/convert-image-from-pil-to-opencv-format
# http://opensource.com/life/15/2/resize-images-python
# ###########################################

# Python 2.7.2

import cv2  # Opencv 3
from PIL import Image  # Image from PIL (Pillow)
import glob
import os
import numpy
from commonFun import check_version


class FaceCrop:
    def __init__(self, open_cv_haar_cascade_path=None):
        if open_cv_haar_cascade_path is None:
            self.casc_path = '/bigData/mylibs/opencv-3.0.0-rc1/data/haarcascades/haarcascade_frontalface_alt.xml'
        else:
            self.casc_path = open_cv_haar_cascade_path

        check_version("numpy", "1.9.1")
        check_version("PIL", "1.1.7")
        check_version("opencv", "3.0.0-rc1")

        if not os.path.exists(self.casc_path):
            raise Exception(self.casc_path + "is an invalid path. " +
                            "It should be a path to the opencv haarcascades xml files folder.")

    @staticmethod
    def detect_faces(image, face_cascade, return_image=False):
        # This function takes a gray scale cv image and finds
        # the patterns defined in the haarcascade function
        # modified from: http://www.lucaamore.com/?p=638

        # variables
        min_size = (20, 20)
        haar_scale = 1.1
        min_neighbors = 3
        haar_flags = 0

        # Equalize the histogram
        cv2.equalizeHist(image, image)

        # Detect the faces
        faces = face_cascade.detectMultiScale(image, scaleFactor=haar_scale,
                                              minNeighbors=min_neighbors, minSize=min_size,
                                              flags=haar_flags)

        # If faces are found
        if isinstance(faces, numpy.ndarray) and return_image:
            for (x, y, w, h) in faces:
                # Convert bounding box to two CvPoints
                pt1 = (int(x), int(y))
                pt2 = (int(x + w), int(y + h))
                cv2.rectangle(image, pt1, pt2, (255, 0, 0), 5, 8, 0)

        if return_image:
            return image
        else:
            return faces

    @staticmethod
    def pil_2_cv_gray(pil_im):
        # Convert a PIL image to a gray scale cv image
        open_cv_image = numpy.array(pil_im.convert('L'))
        cv_im = open_cv_image[:, :].copy()

        return cv_im

    @staticmethod
    def cv_2_pil(cv_im):
        # Convert the cv image to a PIL image
        return Image.frombytes("L", cv_im.shape, cv_im.tostring())

    @staticmethod
    def img_crop(image, crop_box, box_scale):
        # Crop a PIL image with the provided box [x(left), y(upper), w(width), h(height)]

        # Calculate scale factors
        x_delta = int(round(max(crop_box[2] * (box_scale - 1), 0)))
        y_delta = int(round(max(crop_box[3] * (box_scale - 1), 0)))

        # Convert cv box to PIL box [left, upper, right, lower]
        pil_box = [crop_box[0] - x_delta, crop_box[1] - y_delta, crop_box[0] + crop_box[2] + x_delta,
                   crop_box[1] + crop_box[3] + y_delta]

        return image.crop(pil_box)

    @staticmethod
    def resize_image(image, base_width):
        w_percent = (base_width / float(image.size[0]))
        h_size = int((float(image.size[1]) * float(w_percent)))
        result = image.resize((base_width, h_size), Image.ANTIALIAS)

        return result

    def face_crop(self, image_pattern, box_scale=1.5, base_width=250, always_resize=True, filename_suffix="_crop"):
        face_cascade = cv2.CascadeClassifier(self.casc_path)

        images = glob.glob(image_pattern)

        if len(images) == 0:
            print('No Images Found')
            return

        for idx, img in enumerate(images):
            pil_im = Image.open(img)
            cv_im = self.pil_2_cv_gray(pil_im)
            faces = self.detect_faces(cv_im, face_cascade)

            print('Processing image ' + str(idx + 1) + '/' + str(len(images)))

            if isinstance(faces, numpy.ndarray):
                n = 1

                for face in faces:
                    cropped_image = self.img_crop(pil_im, face, box_scale=box_scale)
                    resized_image = self.resize_image(cropped_image, base_width)
                    fname, ext = os.path.splitext(img)

                    if filename_suffix is not None:
                        resized_image.save(fname + filename_suffix + str(n) + ext)
                    else:
                        resized_image.save(fname + ext)

                    n += 1

            elif always_resize:
                # If no faces were found in the image, and we still wish to resize it.
                resized_image = self.resize_image(pil_im, base_width)
                fname, ext = os.path.splitext(img)

                if filename_suffix is not None:
                    resized_image.save(fname + filename_suffix + str(n) + ext)

                else:
                    resized_image.save(fname + ext)

                print('No faces found:' + img + '. The image was resized.')

            else:
                print('No faces found:' + img)


if __name__ == "__main__":
    # Crop all jpegs in a folder. Note: the code uses glob which follows unix shell rules.
    # Use the boxScale to scale the cropping area. 1=opencv box, 2=2x the width and height
    fc = FaceCrop()
    fc.face_crop('testPics/*.jpg')
