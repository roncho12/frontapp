### FrontApp - <i>Face frontalization made easy !</i>

<b>[FrontApp][frontapp]</b> is a [Node.js][nodejs] web app which uses a face frontalization algorithm to produce frontalized images of faces.

You may also download the code and use it to perform [frontalization](#front_standalone) and [face cropping](#facecrop_standalone), independently  of the web application.

The code has been tested on a machine running Ubuntu 14.04.


<hr/>

### Contents:
* [Full installation - web application and frontalization API](#app_installation)
* [Frontalization API installation](#front_standalone) 
* [Credits](#credits)



<hr/>

### <a name="app_installation"></a>Full installation:
This section will explain how to install the web application (on a machine running Linux). Once it's up and running, you will need to [compile the frontalization API](#front_standalone) for it to be available to the web application.

<b>Requirements - </b>

1. [Node.js][nodejs] (version >= 0.12.7).
1. [MondoDB][mongodb] (version >= 2.7).
1. [npm][npm]
1. [ImageMagick][imagemagick]
1. [GraphicsMagick][graphicsmagick]

Once the above requirements are met, go to the web application folder (where `package.json` is located) and run:
```
npm install
```
This will install all of the required Node.js packages listed in `package.json`.

After that you can run:
```
node app.js
```
To start the application.

Once the application is functioning you should compile the [frontzlization API](#front_standalone).

<hr/>

### <a name="front_standalone"></a>Frontalization API:

<b>Requirements - </b>

1. [OpenCV][opencv] (version 3.0 rc1).
1. [DLib][dlib] (version >= 18.15).
1. Python (2.7)
1. [Pillow][pillow]

You will need to install [OpenCV][opencv] yourself.
The version of [DLib][dlib] that we use is provided with the code.

To compile the code (assuming that [OpenCV][opencv] is installed system-wide, and that [DLib][dlib] is located at `/path/to/app/frontalization_API/dlib-18.15`) go to the `frontalization_API` folder and run:
```
g++ -fPIC -shared -I./dlib-18.15 `pkg-config opencv --cflags` frontalize_for_lib.cpp -o libfrontalize.so -lpthread -lX11 `pkg-config opencv --libs`
```

To view the usage and all available options:

```
$ python Frontalizer.py -h
```
output:
```
usage: Frontalizer.py [-h] -ip IMAGES_PATH [-dp DLIB_PATH]
                      [-cp OPENCV_HAAR_PATH] [-op OUTPUT_PATH] [-write]
                      [-crop CROP] [-crop_width CROP_WIDTH]
                      [-crop_height CROP_HEIGHT]
                      [-crop_x_offset CROP_X_OFFSET]
                      [-crop_y_offset CROP_Y_OFFSET] [-symthr SYM]
                      [-blend BLEND] [-debug] [-preproc]

optional arguments:
  -h, --help            show this help message and exit
  -ip IMAGES_PATH       The location of the image(s) that will be processed.
                        You can pass a filename (i.e.: "/home/me/sandra.jpg")
                        or a glob (i.e.: "/home/me/pics/*.jpg").
  -dp DLIB_PATH         Path to dlib facial landmarks file, i.e.:
                        "/home/me/data/shape_predictor_68_face_landmarks.dat".
  -cp OPENCV_HAAR_PATH  Path to the opencv haarcascade xml files, i.e.:
                        "/home/me/opencv-3.0.0-rc1/data/haarcascades".
  -op OUTPUT_PATH       A folder where the results are to be saved.
                        Pass "-write" if you wish to use this option.
  -write                CAUTION: If this argument is used, and the -op option
                        was not passed, existing images will be overwritten
                        with the frontalized images.
  -crop CROP            The size (in pixels) of the square area to be processed
                        when frontalizing the face.c
  -crop_width CROP_WIDTH
                        The width of the cropped face area. If used, 
                        it must be smaller than value used for "crop"
  -crop_height CROP_HEIGHT
                        The height of the cropped face area. If used, 
                        it must be smaller than value used for "crop"
  -crop_x_offset CROP_X_OFFSET
                        The x offset of the cropped face area.
  -crop_y_offset CROP_Y_OFFSET
                        The y offset of the cropped face area.
  -symthr SYM           Threshold for soft symmetry.
  -blend BLEND          Blend factor for soft symmetry.
  -debug                If this argument is used, some debugging information
                        will be printed.
  -preproc              If this argument is used, the images will be
                        preprocessed: the face will be detected and
                        the image will be cropped to 250x250, with
                        the face centered in the image.
                        NOTE: images which are not 250x250 may cause the
                        frontalization code to crash.
```


<hr/>

### <a name="credits"></a>Credits:

* The [original face frontalization algorithm][tal fronalization algo] was developed by [Dr. Tal Hassner][tal homepage]:
>Tal Hassner, Shai Harel\*, Eran Paz\* and Roee Enbar, "Effective Face Frontalization in Unconstrained Images", IEEE Conf. on Computer Vision and Pattern Recognition (CVPR), Boston, June 2015.  
>
>\* These author names are in alphabetical order due to equal contribution.

* The C++ code used to implement the above algorithm is a modification of the code used in the [uniform-lbp][original cpp project] project ([frontalize.cpp][original cpp code]). 


[tal homepage]: http://www.openu.ac.il/home/hassner/index.html
[original cpp project]: https://github.com/berak/uniform-lbp
[original cpp code]: https://github.com/berak/uniform-lbp/blob/master/util/frontalize/frontalize.cpp
[tal fronalization algo]: http://www.openu.ac.il/home/hassner/projects/frontalize/
[picture1]: https://dl.dropboxusercontent.com/u/25710121/FrontApp.png
[nodejs]: https://nodejs.org/en/
[opencv]: http://opencv.org/
[dlib]: http://dlib.net/
[python]: https://www.python.org/
[frontapp]: http://52.20.246.114/
[mongodb]: https://www.mongodb.org/
[npm]: https://www.npmjs.com/
[pillow]: http://pillow.readthedocs.org/installation.html
[imagemagick]: http://www.imagemagick.org/script/index.php
[graphicsmagick]: http://www.graphicsmagick.org/
