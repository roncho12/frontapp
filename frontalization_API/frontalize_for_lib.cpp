#include "opencv2/opencv.hpp"
#include "opencv2/core/utility.hpp"

#include "opencv2/core/core_c.h" // shame, but needed for using dlib
#include <dlib/image_processing.h>
#include <dlib/opencv/cv_image.h>
#include <dlib/all/source.cpp>
//using namespace dlib; // ** don't ever try to**

using namespace cv; // this has to go later than the dlib includes

#include <iostream>
#include <vector>
using namespace std;

#include "profile.h"
#include "frontalizer.h"


struct FrontalizerImpl : public Frontalizer
{
    const dlib::shape_predictor &sp;
    const bool DEBUG_IMAGES;
    const double symBlend;
    const int symThresh;
    const int crop;

    Mat mdl;
    Mat_<double> eyemask;
    vector<Point3d> pts3d;

    FrontalizerImpl(const dlib::shape_predictor &sp, int crop, int symThreshold, double symBlend, bool debug_images)
        : sp(sp)
          , crop(crop)
          , symThresh(symThreshold)
          , symBlend(symBlend)
          , DEBUG_IMAGES(debug_images)
    {
        PROFILEX("Frontalizer")

            // model is rotated 90� already, but still in col-major, right hand coords
            FileStorage fs("data/mdl.yml.gz", FileStorage::READ);
        fs["mdl"] >> mdl;
        fs["eyemask"] >> eyemask;
        blur(eyemask,eyemask,Size(4,4));

        //// if you want to see the 3d model ..
        //Mat ch[3];
        //split(mdl, ch);
        //Mat_<double> depth;
        //normalize(ch[1], depth, -100);
        //imshow("head1", depth);

        // get 2d reference points from image
        vector<Point2d> pts2d;
        Mat meanI = imread("data/reference_320_320.png", 0);
        getkp2d(meanI, pts2d, Rect(80,80, 160,160));


        // get 3d reference points from model
        for(size_t k=0; k<pts2d.size(); k++)
        {
            Vec3d pm = mdl.at<Vec3d>(int(pts2d[k].y), int(pts2d[k].x));
            Point3d p(pm[0], pm[2], -pm[1]);
            pts3d.push_back(p);
        }
    }

    //
    // mostly stolen from Roy Shilkrot's HeadPosePnP
    //
    Mat pnp(const Size &s, vector<Point2d> &pts2d) const
    {
        PROFILEX("pnp")
            // camMatrix based on img size
            int max_d = std::max(s.width,s.height);
        Mat camMatrix = (Mat_<double>(3,3) <<
                max_d,   0, s.width/2.0,
                0,	 max_d, s.height/2.0,
                0,   0,	    1.0);

        // 2d -> 3d correspondence
        Mat rvec,tvec;
        solvePnP(pts3d, pts2d, camMatrix, Mat(1,4,CV_64F,0.0), rvec, tvec, false, SOLVEPNP_EPNP);
        cerr << "rot " << rvec.t() *180/CV_PI << endl;
        cerr << "tra " << tvec.t() << endl;
        // get 3d rot mat
        Mat rotM(3, 3, CV_64F);
        Rodrigues(rvec, rotM);

        // push tvec to transposed Mat
        Mat rotMT = rotM.t();
        rotMT.push_back(tvec.reshape(1, 1));

        // transpose back, and multiply
        return camMatrix * rotMT.t();
    }

    //! expects grayscale img
    void getkp2d(const Mat &I, vector<Point2d> &pts2d, const Rect &r) const
    {
        PROFILEX("getkp2d");
        dlib::rectangle rec(r.x, r.y, r.x+r.width, r.y+r.height);
        dlib::full_object_detection shape = sp(dlib::cv_image<uchar>(I), rec);

        for(size_t k=0; k<shape.num_parts(); k++)
        {
            Point2d p(shape.part(k).x(), shape.part(k).y());
            pts2d.push_back(p);
        }
    }

    inline Mat1d project_vec(const Mat &KP, const Vec3d & p) const
    {
        return  KP * (Mat1d)Matx41d(p[0], p[2], -p[1], 1.0); // swizzle to left-handed coords (from matlab's)
    }
    inline Mat1d project_vec(const Mat &KP, int row, int col) const
    {
        return  project_vec(KP, mdl.at<Vec3d>(row, col));
    }

    //
    // thanks again, Haris. i wouldn't be anywhere without your mind here.
    //
    MatResults project3d(const Mat & test, const Mat & testColor) const
    {
        PROFILEX("project3d");

        MatResults result = MatResults();

        int mid = mdl.cols/2;
        int midi = test.cols/2;
        Rect R(mid-crop/2,mid-crop/2,crop,crop);
        Rect Ri(midi-crop/2,midi-crop/2,crop,crop);

        cout << "R: " << R << endl;
        cout << "Ri: " << Ri << endl;
        cout << "mdl.size(): " << mdl.size() << endl;

        // get landmarks
        vector<Point2d> pts2d;
        getkp2d(test, pts2d, Ri);

        // get pose mat for our landmarks
        Mat KP = pnp(test.size(), pts2d);
        // Store the projection matrix.
        result.matrices.push_back(KP);

        // project img to head, count occlusions
        Mat_<uchar> test2(mdl.size(),127);
        Mat_<uchar> counts(mdl.size(),0);
        Mat test2Color(mdl.rows, mdl.cols, CV_8UC3);
        for (int i=R.y; i<R.y+R.height; i++)
        {
            PROFILEX("proj_1");
            for (int j=R.x; j<R.x+R.width; j++)
            {
                Mat1d p = project_vec(KP, i, j);
                int x = int(p(0) / p(2));
                int y = int(p(1) / p(2));
                if (y < 0 || y > test.rows - 1) continue;
                if (x < 0 || x > test.cols - 1) continue;
                // stare hard at the coord transformation ;)
                test2(i, j) = test.at<uchar>(y, x);
                // Copy a color pixel (BGR)
                test2Color.at<Vec3b>(i, j) = testColor.at<Vec3b>(y, x);
                // each point used more than once is occluded
                counts(y, x) ++;
            }
        }

        // project the occlusion counts in the same way
        Mat_<uchar> counts1(mdl.size(),0);
        for (int i=R.y; i<R.y+R.height; i++)
        {
            PROFILEX("proj_2");
            for (int j=R.x; j<R.x+R.width; j++)
            {
                Mat1d p = project_vec(KP, i, j);
                int x = int(p(0) / p(2));
                int y = int(p(1) / p(2));
                if (y < 0 || y > test.rows - 1) continue;
                if (x < 0 || x > test.cols - 1) continue;
                counts1(i, j) = counts(y, x);
            }
        }
        blur(counts1, counts1, Size(9,9));
        counts1 -= eyemask;
        counts1 -= eyemask;

        // count occlusions in left & right half
        Rect left (0,  0,mid,counts1.rows);
        Rect right(mid,0,mid,counts1.rows);
        double sleft=sum(counts1(left))[0];
        double sright=sum(counts1(right))[0];

        // fix occlusions with soft symmetry
        Mat_<double> weights;
        Mat_<uchar> sym = test2.clone();
        Mat symColor = test2Color.clone();
        if (abs(sleft-sright)>symThresh)
        {
            PROFILEX("proj_3");

            // make weights
            counts1.convertTo(weights,CV_64F);

            Point p,P;
            double m,M;
            int eyeMask_y_offset = -5;
            minMaxLoc(weights,&m,&M,&p,&P);

            double *wp = weights.ptr<double>();
            for (size_t i=0; i<weights.total(); ++i)
                wp[i] = (1.0 - 1.0 / exp(symBlend+(wp[i]/M)));
            // cerr << weights(Rect(mid,mid,6,6)) << endl;

            for (int i=R.y; i<R.y+R.height; i++)
            {
                if (sleft-sright>symThresh) // left side needs fixing
                {
                    for (int j=R.x; j<mid; j++)
                    {
                        int k = mdl.cols-j-1;
                        sym(i,j) = test2(i,j) * (1-weights(i,j)) + test2(i,k) * (weights(i,j));

                        if( i + eyeMask_y_offset >= 0 && eyemask.at<double>(i + eyeMask_y_offset ,j) == 0 ){
                            // symColor.at<Vec3b>(i, j) = test2Color.at<Vec3b>(i,j) * (1-weights(i,j)) + test2Color.at<Vec3b>(i,k) * (weights(i,j));
                            symColor.at<Vec3b>(i, j) = test2Color.at<Vec3b>(i,k);
                        }

                        //                        symColor.at<Vec3b>(i, j) = test2Color.at<Vec3b>(i,j) * (1-weights(i,j)) + test2Color.at<Vec3b>(i,k) * (weights(i,j));
                    }
                }
                if (sright-sleft>symThresh) // right side needs fixing
                {
                    for (int j=mid; j<R.x+R.width; j++)
                    {
                        int k = mdl.cols-j-1;
                        sym(i,j) = test2(i,j) * (1-weights(i,j)) + test2(i,k) * (weights(i,j));

                        if( i + eyeMask_y_offset >= 0 && eyemask.at<double>(i + eyeMask_y_offset ,j) == 0 ){
                            // symColor.at<Vec3b>(i, j) = test2Color.at<Vec3b>(i,j) * (1-weights(i,j)) + test2Color.at<Vec3b>(i,k) * (weights(i,j));
                            symColor.at<Vec3b>(i, j) = test2Color.at<Vec3b>(i,k); 
                        }

                        //                        symColor.at<Vec3b>(i, j) = test2Color.at<Vec3b>(i,j) * (1-weights(i,j)) + test2Color.at<Vec3b>(i,k) * (weights(i,j));
                    }
                }
            }
        }

        if (DEBUG_IMAGES)
        {
            cerr << (sleft-sright) << "\t" << (abs(sleft-sright)>symThresh) << endl;
            imshow("proj",test2);
            if (abs(sleft-sright)>symThresh)
                imshow("weights", weights);
            Mat t = test.clone();
            rectangle(t,Ri,Scalar(255));
            for (size_t i=0; i<pts2d.size(); i++)
                circle(t, pts2d[i], 1, Scalar(0));
            imshow("test3",t);
            imshow("eyemask", eyemask);
        }

        Mat gray;
        Mat colorImg = symColor(R);

        sym.convertTo(gray,CV_8U);

        result.matrices.push_back(sym(R));
        result.matrices.push_back(colorImg);

        return result;
    }

    Rect getFaceRectBy2DPoints(const vector<Point2d> &pts2d, int padding) const{
        int top_y, bottom_y, left_x, right_x, width, height;

        // Set initial values.
        top_y = bottom_y = pts2d[0].y;
        left_x = right_x = pts2d[0].x;
        width = height = 0;

        for (size_t i=0; i<pts2d.size(); i++){
            if(pts2d[i].x < left_x)
                left_x = pts2d[i].x;

            if(pts2d[i].x > right_x)
                right_x = pts2d[i].x;

            if(pts2d[i].y < top_y)
                top_y = pts2d[i].y;

            if(pts2d[i].y > bottom_y)
                bottom_y = pts2d[i].y;
        }

        width = right_x - left_x;
        height = bottom_y - top_y;

        return Rect(left_x - (padding/2), top_y - (padding/2), width + padding, height + padding);
    };

    Mat getFaceMask(const Rect &faceRect) const{
        Mat_<uchar> mask(faceRect.size(),0);

        int center_x = faceRect.width / 2;
        int center_y = faceRect.height / 2;
        int axis_x = (faceRect.width / 2) - (faceRect.width / 20);
        int axis_y = (faceRect.height / 2) + (faceRect.height / 10);
        int angle = 0;
        int start_angle = 0;
        int end_angle = 360;
        Scalar color(255, 255, 255);
        int thickness = -1;

        cout << "faceRect.size(): " << faceRect.size() << endl;
        cout << "faceRect.width: " << faceRect.width << endl;
        cout << "faceRect.height: " << faceRect.height << endl;
        cout << "center_x: " << center_x << endl;
        cout << "center_y: " << center_y << endl;
        cout << "axis_x: " << axis_x << endl;
        cout << "axis_y: " << axis_y << endl;

        ellipse(mask, Point(center_x, center_y), Size(axis_x, axis_y), angle,
                start_angle, end_angle, color, thickness);

        return mask;
    };

    //
    //! 2d eye-alignment
    // Not tested when called from the Python code.
    //
    Mat align2d(const Mat &img) const
    {
        cout << "perfoming 2d eye-alignment" << endl;
        PROFILEX("align2d");

        Mat test;
        resize(img, test, Size(250,250), INTER_CUBIC);

        // get landmarks
        vector<Point2d> pts2d;
        getkp2d(test, pts2d, Rect(0, 0, test.cols, test.rows));

        Point2d eye_l = (pts2d[37] + pts2d[38] + pts2d[40] + pts2d[41]) * 0.25; // left eye center
        Point2d eye_r = (pts2d[43] + pts2d[44] + pts2d[46] + pts2d[47]) * 0.25; // right eye center

        double eyeXdis = eye_r.x - eye_l.x;
        double eyeYdis = eye_r.y - eye_l.y;
        double angle   = atan(eyeYdis/eyeXdis);
        double degree  = angle*180/CV_PI;
        double scale   = 44.0 / eyeXdis; // scale to lfw eye distance

        Mat res;
        Point2f center(test.cols/2, test.rows/2);
        Mat rot = getRotationMatrix2D(center, degree, scale);
        cerr << rot << endl;
        //rot.at<float>(1,2) += eye_l.y - 
        warpAffine(test, res, rot, Size(), INTER_CUBIC, BORDER_CONSTANT, Scalar(127));

        if (DEBUG_IMAGES)
        {
            Mat t = test.clone();
            for (size_t i=0; i<pts2d.size(); i++)
                circle(t, pts2d[i], 1, Scalar(0));
            circle(t, eye_l, 3, Scalar(255));
            circle(t, eye_r, 3, Scalar(255));
            imshow("test2",t);
            imshow("testr",res);
        }
        return res;
    }

    static Ptr<Frontalizer> create(const dlib::shape_predictor &sp, int crop, int symThreshold, double symBlend, bool write)
    {
        return makePtr<FrontalizerImpl>(sp, crop, symThreshold, symBlend, write);
    }

};

Mat performFrontalization(bool write, bool facedet, bool align2d, bool project3d, int crop, int sym, 
        double blend, char * imagepath, char * cascadepath, char * dlibpath, bool debugMode, char * outputpath,
        int crop_x_offset=0, int crop_y_offset=0, int crop_width=0, int crop_height=0){

    Mat projectionMatrix;

    if(debugMode){

        cout << "write, " << write << endl;
        cout << "facedet, " << facedet << endl;
        cout << "align2d, " << align2d << endl;
        cout << "project3d, " << project3d << endl;
        cout << "crop, " << crop << endl;
        cout << "crop_width, " << crop_width << endl;
        cout << "crop_height, " << crop_height << endl;
        cout << "crop_x_offset, " << crop_x_offset << endl;
        cout << "crop_y_offset, " << crop_y_offset << endl;
        cout << "sym, " << sym << endl;
        cout << "blend, " << blend << endl;
        cout << "imagepath, " << imagepath << endl;
        cout << "cascadepath, " << cascadepath << endl;
        cout << "dlibpath, " << dlibpath << endl;
        cout << "debugMode, " << debugMode << endl;
        cout << "outputpath, " << outputpath << endl;

    }

    string dlib_path = string(dlibpath);
    string casc_path = string(cascadepath);
    string path = string(imagepath);

    if(debugMode){
        cout << "dlib_path, " << dlib_path << endl;
        cout << "casc_path, " << casc_path << endl;
        cout << "path, " << path << endl;
    }

    dlib::shape_predictor sp;
    dlib::deserialize(dlib_path) >> sp;

    FrontalizerImpl front(sp,crop,sym,blend,debugMode);
    CascadeClassifier casc(casc_path + "haarcascade_frontalface_alt.xml");
    CascadeClassifier cascp(casc_path + "haarcascade_profileface.xml");

    //
    // !!!
    // if write is enabled,
    // please run this on a **copy** of your img folder,
    //  since this will just replace the images
    //  with the frontalized version !
    // !!!
    //
    if (! write && debugMode)
    {
        namedWindow("orig", 0);
        namedWindow("orig_color", 0);
        namedWindow("front", 0);
    }

    vector<String> str;
    glob(path, str, true);
    for (size_t i=0; i<str.size(); i++)
    {
        cerr << str[i] << endl;
        Mat in = imread(str[i], 0);
        Mat inColor = imread(str[i], CV_LOAD_IMAGE_COLOR);

        if (! write && debugMode)
        {
            imshow("orig", in);
            imshow("orig_color", inColor);
        }
        if (facedet && !casc.empty())
        {
            vector<Rect> rects;
            casc.detectMultiScale(in, rects, 1.3, 4);
            if (rects.size() > 0)
            {
                cerr << "frontal " << rects[0] << endl;
                in = in(rects[0]);
                inColor = inColor(rects[0]);
            }
            else
            {
                cascp.detectMultiScale(in, rects, 1.3, 4);
                if (rects.size() > 0)
                {
                    cerr << "profile_l" << endl;
                    in = in(rects[0]);
                    inColor = inColor(rects[0]);
                }
                else
                {
                    flip(in,in,1);
                    cascp.detectMultiScale(in, rects, 1.3, 4);
                    if (rects.size() > 0)
                    {
                        cerr << "profile_r" << endl;
                        in = in(rects[0]);
                        inColor = inColor(rects[0]);
                    }
                }
            }
        }

        if (align2d)
            in = front.align2d(in);

        Mat out = in;
        Mat outColor = in;

        if (project3d){
            MatResults matRes = front.project3d(in, inColor); 

            projectionMatrix = matRes.matrices[0];
            out = matRes.matrices[1];
            outColor = matRes.matrices[2];

            if(debugMode){
                cout << "projection matrix :" << projectionMatrix << endl;
            }
        }

        // Further cropping of the result, if required.
        if( (crop_width != 0 && crop_width + (crop_x_offset * 2) <= crop) && 
                (crop_height != 0 && crop_height + (crop_y_offset * 2) <= crop) ){
            Rect R(crop_x_offset ,crop_y_offset , crop_width, crop_height);
            outColor = outColor(R);
        }

        if (! write && debugMode)
        {
            imshow("front_color", outColor);

            if (waitKey() == 27) break;
        }
        else
        {
            if(outputpath){
                string filename(str[i]);

                const size_t last_slash_idx = filename.find_last_of("\\/");

                if (std::string::npos != last_slash_idx) {
                    filename.erase(0, last_slash_idx + 1);
                }

                string fullName = outputpath + string("/") + filename;

                imwrite(fullName, outColor);
            }
            else {
                imwrite(str[i], outColor);
            }
        }
    }

    return projectionMatrix;
}


extern "C"{

//////////////////////////////////////////////////////////////////////////////////////////
// This is a wrapper function that can be called from Python, which is heavily based    //
// on a modified version of the frontzlization code from this project:                  // 
// https://github.com/berak/uniform-lbp                                                 //
//////////////////////////////////////////////////////////////////////////////////////////
char * frontalize(bool write, bool facedet, bool align2d, bool project3d, int crop, int sym, 
        double blend, char * imagepath, char * cascadepath, char * dlibpath, bool debugMode,
        char * outputpath, int crop_x_offset=0, int crop_y_offset=0, int crop_width=0, int crop_height=0){

    if(debugMode){

        cout << "in C++ code - frontalize" << endl;
        cout << "write: " << write << endl;
        cout << "facedet: " << facedet << endl;
        cout << "align2d: " << align2d << endl;
        cout << "project3d: " << project3d << endl;
        cout << "crop: " << crop << endl;
        cout << "sym: " << sym << endl;
        cout << "blend: " << blend << endl;
        cout << "imagepath: " << imagepath << endl;
        cout << "cascadepath: " << cascadepath << endl;
        cout << "dlibpath: " << dlibpath << endl;
        cout << "debugMode: " << debugMode << endl;
        cout << "outputpath: " << outputpath << endl;
    }

    Mat projMat = performFrontalization(write, facedet, align2d, project3d, crop, sym, 
            blend, imagepath, cascadepath, dlibpath, debugMode, outputpath, crop_x_offset, 
            crop_y_offset, crop_width, crop_height);

    // Create a string with a specific format so we can 
    // return the projection matrix to the calling Python code.
    char rowBuffer[10000];
    char colBuffer[10000];

    sprintf(rowBuffer, "%d", projMat.rows);
    sprintf(colBuffer, "%d", projMat.cols);

    string rowsStr = string(rowBuffer);
    string colStr = string(colBuffer);

    std::ostringstream o;
    o << projMat;
    string resultAsString  = rowsStr + "_" + colStr + "_" + o.str();

    char * result = (char*)malloc(strlen(resultAsString.c_str()) + 1);
    strcpy(result, resultAsString.c_str());

    return result;
}

}
