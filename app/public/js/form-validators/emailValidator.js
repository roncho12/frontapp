
function EmailValidator() {
    var _local = this;
}

EmailValidator.prototype.validateEmail = function (e)
{
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(e);
};

EmailValidator.prototype.showEmailAlert = function (m)
{
    this.retrievePasswordAlert.attr('class', 'alert alert-error');
    this.retrievePasswordAlert.html(m);
    this.retrievePasswordAlert.show();
};

EmailValidator.prototype.hideEmailAlert = function ()
{
    this.retrievePasswordAlert.hide();
};

EmailValidator.prototype.showEmailSuccess = function (m)
{
    this.retrievePasswordAlert.attr('class', 'alert alert-success');
    this.retrievePasswordAlert.html(m);
    this.retrievePasswordAlert.fadeIn(500);
};