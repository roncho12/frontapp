window.frontapp = window.frontapp || {};
frontapp.tools = frontapp.tools || {};
frontapp.tools.files = null;

frontapp.tools.prepare_upload = function (event) {
    frontapp.tools.files = event.target.files;
    $('#uploadForm input[type=submit]').click();
};

frontapp.tools.upload_files = function (event) {
    var data, i, f, deferred, extra_data;
    event.stopPropagation();
    event.preventDefault();


    if (frontapp.tools.files === null) {
        $('#uploadForm input[type=file]').click();
        return;
    }

    // Inform the user we're processing the image
    frontapp.tools.show_popup("Uploading image...", true);
    extra_data = {};
    extra_data.is_mobile_browser = frontapp.tools.is_mobile_browser();

    // Create a formdata object and add the files
    for (i = 0; i < frontapp.tools.files.length; i++) {
        f = frontapp.tools.files[i];
        data = new FormData();
        data.append(0, f);
        deferred = $.ajax({
            url: '/api/photo_upload',
            type: 'POST',
            data: data,
            cache: false,
            timeout: frontapp.cfg.upload_image_timout,
            dataType: 'json',
            processData: false,
            contentType: false,
            error: function () {
                frontapp.tools.hide_popup();
                frontapp.tools.alert_user("File upload failed. Please try again.");
            }
        });

        deferred.done(frontapp.tools.upload_files_done_callback);
    }
};

frontapp.tools.alert_user = function (message) {
    alert(message);
};

frontapp.tools.upload_files_done_callback = function (data) {
    var container_div, deferred;

    frontapp.tools.files = null;
    frontapp.tools.show_popup("Frontalizing image...", true);
    container_div = document.querySelector('#' + frontapp.cfg.image_container_div_id);

    if (!container_div) {
        container_div = document.createElement("div");
        container_div.id = frontapp.cfg.image_container_div_id;
        document.body.appendChild(container_div);
    }

    if (data.did_succeed === true) {

        deferred = $.post("/api/frontalize_image", {file: data.file});

        deferred.done(function (data) {
            if (data.did_succeed === true) {
                frontapp.tools.show_popup("Downloading result...", true);
                frontapp.tools.add_original_and_front_images(data.file, container_div, frontapp.tools.single_image_ready_callback);

            } else {
                frontapp.tools.hide_popup();
            }
        });
    }
};

frontapp.tools.single_image_ready_callback = function (did_succeed, img) {
    var container, original_src;

    container = document.querySelector('#' + frontapp.cfg.single_image_content_id);

    if (did_succeed === true) {
        container.innerHTML = '';
        original_src = img.src.replace('front_results', 'uploads');

        frontapp.tools.add_original_and_front_images({path: original_src}, container, function () {
            $('#single_image_link').click();
        });

        frontapp.tools.hide_popup();
        frontapp.tools.wrap_images_for_menu();
        frontapp.tools.attach_image_menu_events();
    }
};

frontapp.tools.add_original_and_front_images = function (file, target_container, callback) {
    var img, front_img, src, wrapper, block_a, block_b;

    wrapper = document.createElement("div");
    wrapper.className = "ui-grid-a";
    block_a = document.createElement("div");
    block_a.className = "ui-block-a";
    block_b = document.createElement("div");
    block_b.className = "ui-block-b";

    wrapper.appendChild(block_a);
    wrapper.appendChild(block_b);

    img = document.createElement("img");
    // The frontalized image
    front_img = document.createElement("img");

    src = file.path;
    src = src.replace('app/public/', '');
    src = src.replace('app/server/', '');

    img.src = src;
    img.className = frontapp.cfg.uploaded_image_class;
    block_a.appendChild(img);

    front_img.src = src.replace('uploads', 'front_results');
    front_img.className = frontapp.cfg.uploaded_image_front_class;
    block_b.appendChild(front_img);

    target_container.appendChild(wrapper);

    if (callback) {
        callback(true, front_img);
    }
};

// All images that we're uploaded/processed should be wrapped in a link
// so the "Actions" menu could be displayed.
frontapp.tools.wrap_images_for_menu = function () {
    var images, i, curr_image, wrap, parent;

    images = $('.uploaded_image, .uploaded_image_front');

    for (i = 0; i < images.length; i++) {
        curr_image = images[i];
        parent = $(curr_image).parent();

        if (!$(curr_image).attr('wrapped')) {
            wrap = $('<a>', {
                href: "#image_menu",
                "data-rel": "popup",
                "data-transition": "slideup"
            });

            $(curr_image).detach();
            $(wrap).append(curr_image);
            $(parent).append(wrap);
            $(curr_image).attr('wrapped', true);
        }
    }

};

frontapp.tools.has_image_loaded = function (img) {
    if (!img.complete) {
        return false;
    }

    if (img.naturalWidth === 0) {
        return false;
    }

    return true;
};

frontapp.tools.show_image_if_loaded = function (img, num_tries, callback) {
    var orig_src, timeout;

    if (num_tries < frontapp.cfg.max_num_checks_image_exists) {
        num_tries++;
        // Force reloading.
        orig_src = img.src;
        img.src = "";
        img.src = orig_src;

        if (frontapp.tools.has_image_loaded(img) === false) {
            timeout = frontapp.cfg.image_exists_check_interval + (1000 * num_tries * frontapp.cfg.image_exists_check_interval_weight);
            console.log('frontapp.tools.add_image_if_exists', num_tries, timeout);
            frontapp.tools.log_at_server('frontapp.tools.add_image_if_exists: ' + num_tries + " " + timeout);

            setTimeout(function () {
                frontapp.tools.show_image_if_loaded(img, num_tries, callback);
            }, timeout);

        } else {
            img.style.display = "";
            if (callback) {
                callback(true, img);
            }

        }
    } else {
        if (callback) {
            callback(false, img);
        }
    }

};

frontapp.tools.init_popup = function () {
    $('#' + frontapp.cfg.popup_elm_id).popup();
};

frontapp.tools.init_image_details_popup = function () {
    $('#' + frontapp.cfg.image_details_popup_id).popup();
};

frontapp.tools.show_popup = function (message, show_loading_gif) {
    if (String(message).trim()) {
        frontapp.tools.set_popup_text(message);
    }

    if (show_loading_gif === true) {
        $('#' + frontapp.cfg.popup_elm_id + ' img#loading').show();
    } else {
        $('#' + frontapp.cfg.popup_elm_id + ' img#loading').hide();
    }

    $('#' + frontapp.cfg.popup_elm_id).popup("open");
};

frontapp.tools.hide_popup = function (message) {
    $('#' + frontapp.cfg.popup_elm_id).popup("close");
};

frontapp.tools.set_popup_text = function (text_str) {
    $('#' + frontapp.cfg.popup_elm_id + ' p.pop_text').text(text_str);
};

frontapp.tools.is_mobile_browser = function () {
    var agent_string = navigator.userAgent || navigator.vendor || window.opera;
    if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(agent_string) ||
            /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(agent_string.substr(0, 4))) {
        return true;
    } else {
        return false;
    }
};

frontapp.tools.log_at_server = function (text) {
    $.post("/api/log_message", {message: text});
};

frontapp.tools.delete_image = function (path, callback) {
    var deferred, filename;

    filename = path.split('/').pop();
    deferred = $.post("/api/delete_image", {filename: filename});

    deferred.done(function (data) {
        if (callback) {
            $('#image_menu').popup("close");
            callback(path, data);

        } else {
            $('#image_menu').popup("close");
            $('img[src="' + filename + '"').remove();
        }
    });
};

// Pass the original image path to this function.
frontapp.tools.remove_original_and_frontalized_images = function (path, data) {
    $('img[src="' + path + '"').parents('div.ui-grid-a').remove();
};

frontapp.tools.attach_image_menu_events = function () {
    // Ensure the popup contains the data we will require to perform actions.
    $('a[href="#image_menu"]').on('click', function (event, ui) {
        var popup, link, filename, upload_time, time_string, display_time;

        link = $(this);
        popup = $(link.attr('href'));
        popup.attr('img_src', $(link).find('img').attr('src'));
        filename = popup.attr('img_src').replace(/[_][0-9]+\./, '.').split('/')[1];

        // Ugly, but it works ...
        time_string = popup.attr('img_src').match(/[_][0-9]+\./).pop().slice(1).split('.')[0];
        display_time = new Date(parseInt(time_string));
        // Add 3 hours to account for timezones.
        display_time.setHours(display_time.getHours() + 3);
        upload_time = display_time.toString().replace(/\sGMT.*/, '');

        popup.attr('img_src', $(link).find('img').attr('src'));
        popup.attr('img_display_filename', filename);
        popup.attr('img_upload_time', upload_time);
    });
};