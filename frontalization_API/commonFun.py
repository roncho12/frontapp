def print_exp_ver_msg(name, exp_ver, found_ver):
    print("warning: expected " + name + " version - " + exp_ver
          + ", but you are using version " + found_ver)

def check_version(name, expected_ver):
    if name.lower() == "numpy":
        try:
            from numpy import __version__ as found_ver

        except Exception as e:
            raise e

    elif name.lower() == "opencv":
        try:
            from cv2 import __version__ as found_ver

        except Exception as e:
            raise e

    elif name.lower() == "pil":
        try:
            from PIL.Image import VERSION as found_ver

        except Exception as e:
            raise e

    else:
        raise Exception("unrecognized package/module name: " + name)

    if found_ver != expected_ver:
        print_exp_ver_msg(name.lower(), expected_ver, found_ver)
        return False

    return True

