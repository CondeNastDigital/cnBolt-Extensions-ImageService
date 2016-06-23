<?php
namespace Bolt\Extension\CND\ImageService;
use Bolt;
use Bolt\Application;
use Bolt\Extension\CND\ImageService\Controller\ImageController;
use Bolt\Extension\CND\ImageService\Provider\FieldProvider;
use Bolt\Extension\CND\ImageService\Provider\ServiceProvider;
use Bolt\Extension\CND\ImageService\Service\ImageService;
use Bolt\Extension\SimpleExtension;

class Extension extends SimpleExtension
{
    CONST APP_EXTENSION_KEY = "cnd.image-service";

    public function getServiceProviders()
    {
        return [
            $this,
            new FieldProvider(),
            new Serviceprovider($this->getConfig())
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerAssets(){
        return [];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigPaths(){
        return ['templates'];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigFunctions(){
        return [
            'imageservice' => [[$this->getContainer()[self::APP_EXTENSION_KEY.".service"], "imageUrl" ]]
        ];
    }


    /**
     * {@inheritdoc}
     */
    protected function registerMenuEntries()
    {
        /* @var \Bolt\Application $app */
        $app = $this->getContainer();
        /* @var ImageService $service */
        $service = $app[self::APP_EXTENSION_KEY.".service"];

        return $service->getServiceMenu();
    }

    /**
     * {@inheritdoc}
     */
    protected function registerBackendControllers()
    {
        /* @var \Bolt\Application $app */
        $app = $this->getContainer();
        $config = $this->getConfig();
        return [
            '/image-service/image' => new ImageController($app, $config),
        ];
    }
}