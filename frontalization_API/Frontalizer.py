from ctypes import *
import numpy as np
import os
import glob
import platform

from FaceCrop import FaceCrop
from commonFun import check_version


class Frontalizer(object):
    def __init__(self, cascade_path=None, dlib_path=None, ignore_OS=False):
        path_to_lib_file = os.path.join(os.getcwd(), 'libfrontalize.so')

        self.lib = cdll.LoadLibrary(path_to_lib_file)
        self.lib.frontalize.restype = c_char_p

        self.cascade_path = "/bigData/temp/opencv-3.0.0-rc1/data/haarcascades" if cascade_path is None else cascade_path
        self.dlib_path = "data/shape_predictor_68_face_landmarks.dat" if dlib_path is None else dlib_path

        self.raw_result = None
        self.arguments = None
        self.result = {"projection_mat": None}

        check_version("numpy", "1.9.1")

        if platform.system().lower() != "linux" and not ignore_OS:
            raise Exception('This code has not been tested on any OS other than Linux. ' +
                            'IF you still wish to use is on Windows or Mac, pass "ignore_OS=True" ' +
                            'as a parameter when initializing this class (Frontalizer).')

    def run(self, write=False, facedet=True, align2d=False, project3d=True, crop=120,
            sym=9000, blend=0.7, debugMode=False, pathToImages=None, preProcessImages=False,
            arguments=None, output_path=None, crop_width=110, crop_height=140, crop_x_offset=20,
            crop_y_offset=5):

        if arguments is not None:
            write = arguments.write
            self.cascade_path = arguments.opencv_haar_path
            self.dlib_path = arguments.dlib_path
            blend = arguments.blend
            debugMode = arguments.debug
            pathToImages = arguments.images_path
            crop = arguments.crop
            preProcessImages = arguments.preprocess
            sym = arguments.sym
            output_path = arguments.output_path
            crop_width = arguments.crop_width
            crop_height = arguments.crop_height
            crop_x_offset = arguments.crop_x_offset
            crop_y_offset = arguments.crop_y_offset

        # if output_path is not None:
        #     output_path = output_path.strip('/')

        self.validateArguments(pathToImages, self.dlib_path, self.cascade_path, output_path,
                               crop_width, crop_height, crop_x_offset, crop_y_offset, crop)

        if pathToImages is None:
            raise Exception("you must pass an image path to be processed.")

        if preProcessImages:
            # Detect faces in images and crop the pictures around the faces. Even if
            # the faces cannot be detected, the image will still be resized to 250x250 pixels.
            self.preprocessImages(pathToImages)

        blend = c_double(blend)
        imagepath = c_char_p(pathToImages)
        cascadepath = c_char_p(self.cascade_path)
        dlibpath = c_char_p(self.dlib_path)
        outputPath = c_char_p(output_path)

        self.raw_result = self.lib.frontalize(write, facedet, align2d, project3d, crop, sym, blend,
                                              imagepath, cascadepath, dlibpath, debugMode, outputPath,
                                              crop_x_offset, crop_y_offset, crop_width, crop_height, )

        self.parse_raw_result()

        return self.result

    def parse_raw_result(self):
        data = self.raw_result.split('_')
        num_rows = int(data[0])
        num_cols = int(data[1])

        raw_mat = data[2]
        raw_mat = raw_mat.replace(';', ',')
        raw_mat = raw_mat.replace('\n', '')
        raw_mat = raw_mat.replace('[', '')
        raw_mat = raw_mat.replace(']', '')
        new_vec = np.array([float(x) for x in raw_mat.split(',')])
        shape = (num_rows, num_cols)
        self.result["projection_mat"] = new_vec.reshape(shape)

    def preprocessImages(self, pathToImages):
        print("preprocessing images...")
        fc = FaceCrop(open_cv_haar_cascade_path=os.path.join(self.cascade_path, 'haarcascade_frontalface_alt.xml'))
        fc.face_crop(pathToImages, always_resize=True, filename_suffix=None)

    def parseArguments(self):
        import argparse
        from argparse import RawTextHelpFormatter

        parser = argparse.ArgumentParser(formatter_class=RawTextHelpFormatter,
                                         epilog='NOTES:' +
                                         '\n1) Some parameters are not modifiable when using the command line.' +
                                         '\n   You can change those if you run this code by calling it from another script.' +
                                         '\n2) Images which are not 250x250 may cause the frontalization code to crash.' +
                                         '\n3) To view the results without saving them to disk, pass "-debug" and' +
                                         '\n   do NOT pass "-write".')

        parser.add_argument('-ip', action='store', dest='images_path', required=True,
                            help='The location of the image(s) that will be processed.\n' +
                                 'You can pass a filename (i.e.: "/home/me/sandra.jpg")\n' +
                                 'or a glob (i.e.: "/home/me/pics/*.jpg").')

        parser.add_argument('-dp', action='store', dest='dlib_path',
                            help='Path to dlib facial landmarks file, i.e.:\n' +
                                 '"/home/me/data/shape_predictor_68_face_landmarks.dat".')

        parser.add_argument('-cp', action='store', dest='opencv_haar_path',
                            help='Path to the opencv haarcascade xml files, i.e.:\n' +
                                 '"/home/me/opencv-3.0.0-rc1/data/haarcascades".')

        parser.add_argument('-op', action='store', dest='output_path',
                            help='A folder where the results are to be saved.\n' +
                                 'Pass "-write" if you wish to use this option.')

        parser.add_argument('-write', action='store_true', dest='write',
                            help='CAUTION: If this argument is used, and the -op option\n' +
                                 'was not passed, existing images will be overwritten\n' +
                                 'with the frontalized images.')

        parser.add_argument('-crop', action='store', dest='crop', type=int, default=150,
                            help='The size (in pixels) of the square area to be processed\n' +
                                 'when frontalizing the face.c')

        parser.add_argument('-crop_width', action='store', dest='crop_width', type=int, default=110,
                            help='The width of the cropped face area. If used, \n' +
                                 'it must be smaller than value used for "crop"\n')

        parser.add_argument('-crop_height', action='store', dest='crop_height', type=int, default=140,
                            help='The height of the cropped face area. If used, \n' +
                                 'it must be smaller than value used for "crop"\n')

        parser.add_argument('-crop_x_offset', action='store', dest='crop_x_offset', type=int, default=20,
                            help='The x offset of the cropped face area.\n')

        parser.add_argument('-crop_y_offset', action='store', dest='crop_y_offset', type=int, default=5,
                            help='The y offset of the cropped face area.\n')

        parser.add_argument('-symthr', action='store', dest='sym', type=int, default=9000,
                            help='Threshold for soft symmetry.')

        parser.add_argument('-blend', action='store', dest='blend', type=float, default=0.9,
                            help='Blend factor for soft symmetry.')

        parser.add_argument('-debug', action='store_true', dest='debug',
                            help='If this argument is used, some debugging information\n' +
                                 'will be printed.')

        parser.add_argument('-preproc', action='store_true', dest='preprocess', default=False,
                            help='If this argument is used, the images will be\n' +
                                 'preprocessed: the face will be detected and\n' +
                                 'the image will be cropped to 250x250, with\n' +
                                 'the face centered in the image.\n' +
                                 'NOTE: images which are not 250x250 may cause the\n' +
                                 'frontalization code to crash.')

        self.arguments = parser.parse_args()

    @staticmethod
    def validateArguments(images_path, dlib_path, opencv_haar_path, output_folder, crop_width,
                          crop_height, crop_x_offset, crop_y_offset, crop):

        # Check folders/files exist
        if not glob.glob(images_path):
            raise Exception('the path to the image(s) "' + images_path + '"' + ' does not exist, ' +
                            'or no images were found.')

        if dlib_path is not None:
            if not os.path.isfile(dlib_path):
                raise Exception('the path to the dlib facial landmarks file is incorrect. "' +
                                dlib_path + '"' + ' does not exist, or is not a file.')

        if opencv_haar_path is not None:
            if not os.path.isdir(opencv_haar_path):
                raise Exception('the path to the opencv haarcascade folder "' +
                                opencv_haar_path + '"' + ' does not exist, or is not a directory.')

            if not glob.glob(os.path.join(opencv_haar_path, 'haarcascade*.xml')):
                raise Exception('no xml files that match "haarcascade*.xml" were found at "' +
                                opencv_haar_path + '". did you specify the correct path?')

        if output_folder is not None:
            if not os.path.isdir(output_folder):
                raise Exception('"' + output_folder + '"' + ' does not exist, or is not a directory. ' +
                                'You must create it yourself if you wish to store results in this folder.')

        if (crop_x_offset * 2) + crop_width > crop:
            raise Exception('The following must be true: (crop_x_offset * 2) + crop_width <= crop')

        if (crop_y_offset * 2) + crop_height > crop:
            raise Exception('The following must be true: (crop_y_offset * 2) + crop_height <= crop')


if __name__ == "__main__":
    f = Frontalizer()
    f.parseArguments()
    f.run(arguments=f.arguments)

    # result = f.run(debugMode=True, pathToImages='data/images/*.jpg', preProcessImages=False, blend=0.9, sym=5000)
    # print("result matrix shape: ", f.result["projection_mat"].shape)
    # print("result matrix: ", f.result["projection_mat"])
