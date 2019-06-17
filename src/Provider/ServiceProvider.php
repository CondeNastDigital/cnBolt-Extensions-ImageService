<?php

namespace Bolt\Extension\CND\ImageService\Provider;

use Bolt\Extension\CND\ImageService\Extension;
use Bolt\Extension\CND\ImageService\Field\ImageServiceField;
use Bolt\Extension\CND\ImageService\Service\FileService;
use Bolt\Extension\CND\ImageService\Service\ImageService;
use Bolt\Storage\FieldManager;
use Silex\Application;
use Silex\ServiceProviderInterface;

class ServiceProvider implements ServiceProviderInterface
{
    /** @var array $config */
    private $config;

    public function __construct(array $config){
        $this->config = $config;
    }

    public function register(Application $app)
    {
        $app[Extension::APP_EXTENSION_KEY.".image"] = $app->share(
            function ($app) {
                return new ImageService($app, $this->config);
            }
        );

        $app[Extension::APP_EXTENSION_KEY.".file"] = $app->share(
            function ($app) {
                return new FileService($app);
            }
        );

    }

    public function boot(Application $app){
    }
}