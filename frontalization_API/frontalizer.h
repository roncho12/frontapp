#ifndef __Frontalizer_onboard__
#define __Frontalizer_onboard__

#include "opencv2/core.hpp"



//
//@brief  apply a one-size-fits-all 3d model transformation (POSIT style), also do 2d eye-alignment, if nessecary.
//

// fwd:
class dlib::shape_predictor;

class MatResults{
    public:
        std::vector<Mat> matrices;
};

struct Frontalizer
{
    virtual cv::Mat align2d(const cv::Mat &imgray) const = 0;
   /*  virtual cv::Mat project3d(const cv::Mat &imgray) const = 0; */
    virtual MatResults project3d(const cv::Mat &imgray, const cv::Mat &imcolor) const = 0;
    virtual Rect getFaceRectBy2DPoints(const vector<Point2d> &pts2d, int padding) const = 0;
    virtual cv::Mat getFaceMask(const Rect &faceRect) const = 0;

    static cv::Ptr<Frontalizer> create(const dlib::shape_predictor &sp, int crop, int symThreshold, double symBlend, bool write);
};


#endif // __Frontalizer_onboard__

