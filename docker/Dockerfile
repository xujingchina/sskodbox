FROM alpine:3.19

LABEL maintainer="sskodbox" \
      description="sskodbox - Web File Manager & Collaboration Platform"

RUN apk add --no-cache \
        nginx \
        supervisor \
        bash \
        php81 \
        php81-fpm \
        php81-pdo_mysql \
        php81-pdo_sqlite \
        php81-mysqli \
        php81-bcmath \
        php81-exif \
        php81-zip \
        php81-xml \
        php81-mbstring \
        php81-gd \
        php81-opcache \
        php81-session \
        php81-json \
        php81-curl \
        php81-iconv \
        php81-fileinfo \
        php81-openssl \
        php81-redis \
        php81-simplexml \
        php81-xmlreader \
        php81-xmlwriter \
    && ln -sf /usr/bin/php81 /usr/bin/php \
    && rm -rf /var/cache/apk/* /tmp/*

WORKDIR /var/www/kod

COPY . /var/www/kod/

RUN mkdir -p /var/www/kod/data/system \
             /var/www/kod/data/temp/files \
             /var/www/kod/data/temp/log \
             /var/www/kod/data/temp/thumb \
             /var/www/kod/data/files \
             /run/php81 \
             /var/log/supervisor \
    && chmod -R 777 /var/www/kod/data \
    && rm -f /var/www/kod/config/setting_user.php

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/php.ini /etc/php81/conf.d/kodbox.ini
COPY docker/php-fpm.conf /etc/php81/php-fpm.d/www.conf

RUN chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
