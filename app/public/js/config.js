window.frontapp = window.frontapp || {};

frontapp.cfg = frontapp.cfg || {
    image_container_div_id: "gallery_content",
    single_image_content_id: "single_image_content",
    uploaded_image_class: "uploaded_image",
    uploaded_image_front_class: "uploaded_image_front",
    max_num_checks_image_exists: 20,
    image_exists_check_interval: 2000, // ms
    image_exists_check_interval_weight: 0.1,
    popup_elm_id: 'frontapp_popup',
    image_details_popup_id: 'image_details',
    single_image_page_id: 'single_image_page',
    upload_image_timout: 25000 //  We allow 25 seconds since mobile networks can be slow
};

