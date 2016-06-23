<?php
namespace Bolt\Extension\CND\ImageService;
use Bolt;
use Bolt\Asset\File\JavaScript;
use Bolt\Asset\File\Stylesheet;
use Bolt\Controller\Zone;
use Bolt\Extension\SimpleExtension;
use Silex\ControllerCollection;

class Extension extends SimpleExtension
{
    CONST APP_EXTENSION_KEY = "cnd.image-service";
    CONST APP_SERVICE_KEY = "cnd.image-service.service";

    /**
     * {@inheritdoc}
     */
    protected function registerServices(Application $app)
    {
        $app[self::APP_SERVICE_KEY] = $app->share(
            function ($app) {
                return new ImageService($this->getConfig(), $app);
            }
        );
    }

    /**
     * {@inheritdoc}
     */
    public function registerFields(){
        return [
            new Field\ImageServiceField(),
            // new Field\ImageListServiceField(),
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
    protected function registerMenuEntries()
    {
        /* @var \Bolt\Application $app */
        $app = $this->getContainer();
        /* @var ImageService $service */
        $service = $app[self::APP_SERVICE_KEY];

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