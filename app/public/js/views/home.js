
$(document).ready(function () {
    var deferred, hc;

    hc = new HomeController();

    $.mobile.ajaxEnabled = false;
    $.mobile.ajaxFormsEnabled = false;

    deferred = $.get('/api/get_user_photos');

    deferred.done(function (res) {
        hc.add_user_images_to_DOM(res);
        frontapp.tools.wrap_images_for_menu();
        frontapp.tools.attach_image_menu_events();
    });

    // Initialize the popups.
    frontapp.tools.init_popup();
    frontapp.tools.init_image_details_popup();

    $('a#menu_item_delete_image').on('click', function (e) {
        var image_src = $(e.target).parents('#image_menu').attr('img_src');
        frontapp.tools.delete_image(image_src, frontapp.tools.remove_original_and_frontalized_images);
    });

    $('a#menu_item_view_image_details').on('click', function (e) {
        var details_elm, parent_with_data;

        parent_with_data = $(e.target).parents('#image_menu');
        details_elm = $('#' + frontapp.cfg.image_details_popup_id);
        details_elm.find('td.filename').text(parent_with_data.attr('img_display_filename'));
        details_elm.find('td.upload_time').text(parent_with_data.attr('img_upload_time'));
        details_elm.find('img#image_details_thumbnail').attr('src', parent_with_data.attr('img_src'));

        // Close the menu
        $('#image_menu').popup("close");

        // Show the details.
        setTimeout(function () {
            $('#image_details').popup("open");
        }, 500);



    });

});