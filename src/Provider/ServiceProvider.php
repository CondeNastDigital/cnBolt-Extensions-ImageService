<?php

namespace Bolt\Extension\CND\ImageService\Provider;

use Bolt\Extension\CND\ImageService\Extension;
use Bolt\Extension\CND\ImageService\Field\ImageServiceField;
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
        $app[Extension::APP_EXTENSION_KEY.".service"] = $app->share(
            function ($app) {
                return new ImageService($app, $this->config);
            }
        );

    }

    public function boot(Application $app){
    }
}