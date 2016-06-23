<?php
namespace Bolt\Extension\CND\ImageService\Controller;

use Silex\Application;
use Silex\ControllerCollection;
use Silex\ControllerProviderInterface;
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

        // $ctr->match('/{type}', [$this, 'test']);

        return $ctr;
    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function text(Request $request, $type)
    {
        return new Response('Koala in a tree!', Response::HTTP_OK);
    }
}