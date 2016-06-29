<?php
namespace Bolt\Extension\CND\ImageService\Controller;

use Bolt\Extension\CND\ImageService\Extension;
use Bolt\Extension\CND\ImageService\Service\ImageService;
use Silex\Application;
use Silex\ControllerCollection;
use Silex\ControllerProviderInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
* The controller
*/
class ImageController implements ControllerProviderInterface
{
    /** @var Application */
    protected $container;

    /**
    * {@inheritdoc}
    */
    public function connect(Application $app)
    {
        $this->container = $app;

        /** @var ControllerCollection $ctr */
        $ctr = $app['controllers_factory'];

        $ctr->get('/search', [$this, 'search']);

        return $ctr;
    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function search(Request $request)
    {
        $text = $request->get('q','');
        $text = strip_tags(urldecode($text));

        /* @var ImageService $service */
        $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

        $images = $service->imageSearch($text);

        return new JsonResponse([
            "search" => $text,
            "items" => $images,
            "success" => true
        ]);
    }
}